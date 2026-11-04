import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  actorKey,
  getItem,
  isRoleItem,
  movieKey,
  optionalId,
  parseId,
  toActor,
  toRole,
} from "../shared/db";
import { isResponse, response, serverError } from "../shared/http";
import { logRequest } from "../shared/request-logger";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logRequest(event);

  const actorId = parseId(event.pathParameters?.actorID);
  if (actorId === undefined) {
    return response(400, { message: "actorID must be a positive integer" });
  }

  const movieId = optionalId(event.queryStringParameters?.movie, "movie");
  if (isResponse(movieId)) return movieId;
  try {
    const actorItem = await getItem(actorKey(actorId), actorKey(actorId));
    if (!actorItem) {
      return response(404, { message: `Actor ${actorId} not found` });
    }
    const actor = toActor(actorItem);
    if (movieId === undefined) {
      return response(200, { data: actor });
    }

    const movie = await getItem(movieKey(movieId), movieKey(movieId));
    if (!movie) {
      return response(404, { message: `Movie ${movieId} not found` });
    }

    const roleItem = await getItem(movieKey(movieId), actorKey(actorId));
    if (!roleItem || !isRoleItem(roleItem)) {
      return response(200, { data: actor });
    }
    return response(200, {
      data: { ...actor, roleDescription: toRole(roleItem).roleDescription },
    });
  } catch (err) {
    return serverError(err);
  }
};
