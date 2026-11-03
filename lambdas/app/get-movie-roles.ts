import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  actorKey,
  ddb,
  getItem,
  isRoleItem,
  movieKey,
  parseId,
  tableName,
  toRole,
} from "../shared/db";
import { response } from "../shared/http";
import { logRequest } from "../shared/request-logger";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logRequest(event);

  const movieId = parseId(event.pathParameters?.movieID);
  if (movieId === undefined) {
    return response(400, { message: "movieID must be a positive integer" });
  }

  const actorParam = event.queryStringParameters?.actor;
  const actorId = parseId(actorParam);
  if (actorParam !== undefined && actorId === undefined) {
    return response(400, { message: "actor must be a positive integer" });
  }

  try {
    const movie = await getItem(movieKey(movieId), movieKey(movieId));
    if (!movie) {
      return response(404, { message: `Movie ${movieId} not found` });
    }

    if (actorId !== undefined) {
      const actor = await getItem(actorKey(actorId), actorKey(actorId));
      if (!actor) {
        return response(404, { message: `Actor ${actorId} not found` });
      }

      const item = await getItem(movieKey(movieId), actorKey(actorId));
      const roles = item && isRoleItem(item) ? [toRole(item)] : [];
      return response(200, { data: roles });
    }

    const queryResult = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": movieKey(movieId),
          ":sk": "a#",
        },
      })
    );

    const resultItems = queryResult.Items ?? [];
    return response(200, { data: resultItems.filter(isRoleItem).map(toRole) });
  } catch (err) {
    console.error("DynamoDB error:", err);
    return response(500, { message: "Internal server error" });
  }
};
