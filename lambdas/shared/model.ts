// Table keys, item types and mappers. No AWS clients, so the CDK app can import it too.
import type { APIGatewayProxyResult } from 'aws-lambda';
import { response } from './http';

// Single-table keys:
//   Movie: m#movieID | m#movieID
//   Actor: a#actorID | a#actorID
//   Role:  m#movieID | a#actorID
export const movieKey = (movieId: number) => `m#${movieId}`;
export const actorKey = (actorId: number) => `a#${actorId}`;

export interface Movie {
  movieId: number;
  title: string;
  releaseDate: string;
  overview: string;
}

export interface Actor {
  actorId: number;
  name: string;
  dateOfBirth: string;
  bio: string;
}

export interface Role {
  movieId: number;
  actorId: number;
  roleName: string;
  roleDescription: string;
}

export const isMovieItem = (item: Record<string, unknown>) =>
  typeof item.SK === 'string' && item.SK.startsWith('m#');
export const isRoleItem = (item: Record<string, unknown>) =>
  typeof item.PK === 'string' && item.PK.startsWith('m#') &&
  typeof item.SK === 'string' && item.SK.startsWith('a#');

export const toRole = ({ movieId, actorId, roleName, roleDescription }: Record<string, any>): Role => ({
  movieId,
  actorId,
  roleName,
  roleDescription,
});

export const toActor = ({ actorId, name, dateOfBirth, bio }: Record<string, any>): Actor => ({
  actorId,
  name,
  dateOfBirth,
  bio,
});

export const parseId = (value: string | undefined): number | undefined => {
  const trimmed = value?.trim();
  if (trimmed === undefined || !/^[1-9]\d*$/.test(trimmed)) return undefined;
  const id = Number(trimmed);
  return Number.isSafeInteger(id) ? id : undefined;
};

export const optionalId = (
  value: string | undefined,
  name: string,
): number | undefined | APIGatewayProxyResult => {
  if (value === undefined) return undefined;
  const id = parseId(value);
  if (id === undefined) return response(400, { message: `${name} must be a positive integer` });
  return id;
};

export const idFromBody = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return parseId(String(value));
  if (typeof value === 'string') return parseId(value);
  return undefined;
};