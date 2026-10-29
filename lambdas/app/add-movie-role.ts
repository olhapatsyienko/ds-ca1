import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, parseId, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";
import { logRequest } from "../shared/request-logger";

const idFromBody = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value)) return parseId(String(value));
  if (typeof value === "string") return parseId(value);
  return undefined;
};

const textFromBody = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logRequest(event);

  const body = parseJsonObject(event);
  if (isResponse(body)) return body;

  const movieId = idFromBody(body.movieId);
  const actorId = idFromBody(body.actorId);
  const roleName = textFromBody(body.roleName);
  const roleDescription = textFromBody(body.roleDescription);
  if (movieId === undefined) {
    return response(400, { message: "movieId must be a positive integer" });
  }
  if (actorId === undefined) {
    return response(400, { message: "actorId must be a positive integer" });
  }
  if (roleName === undefined || roleDescription === undefined) {
    return response(400, { message: "roleName and roleDescription must be non-empty strings" });
  }

  const role: Role = { movieId, actorId, roleName, roleDescription };

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: tableName,
              Key: { PK: movieKey(role.movieId), SK: movieKey(role.movieId) },
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            ConditionCheck: {
              TableName: tableName,
              Key: { PK: actorKey(role.actorId), SK: actorKey(role.actorId) },
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: movieKey(role.movieId),
                SK: actorKey(role.actorId),
                ...role,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      })
    );
    return response(201, { message: "Role added", data: role });
  } catch (err) {
    if (err instanceof TransactionCanceledException) {
      const reasons = err.CancellationReasons ?? [];
      if (reasons[0]?.Code === "ConditionalCheckFailed") {
        return response(404, { message: `Movie ${movieId} not found` });
      }
      if (reasons[1]?.Code === "ConditionalCheckFailed") {
        return response(404, { message: `Actor ${actorId} not found` });
      }
      if (reasons[2]?.Code === "ConditionalCheckFailed") {
        return response(409, { message: `Role for actor ${actorId} in movie ${movieId} already exists` });
      }
    }
    console.error("DynamoDB error:", err);
    return response(500, { message: "Internal server error" });
  }
};
