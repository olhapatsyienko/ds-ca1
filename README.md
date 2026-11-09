## Cloud App Development - Assignment.

This repository contains the completed serverless movie-cast Web API and the CDK code that provisions it on AWS. The starter left the GET and POST behaviour unfinished. The work recorded below fills that in: both endpoints, their error handling, Cognito authentication on GET, an API key on POST and the shared helpers the handlers use.

__Objective:__ Demonstrate your knowledge of serverless Web API design and deployment by completing the implementation.

### What was done

The commits follow the implementation strategy in the brief.

#### 1. GET requests, happy path

- `GET /movies/{movieID}/roles` returns every role for that movie as `{ "data": [ ... ] }`.
- `?actor={actorID}` returns only that actor's role in the movie.
- `GET /actors/{actorID}` returns the actor profile (id, name, date of birth, bio).
- `?movie={movieID}` adds `roleDescription` when that actor has a role in the movie.

Handlers map table items to `Role` and `Actor` with `toRole` and `toActor`. Responses contain model fields, not partition or sort keys.

#### 2. Error handling on GET

- `400` when a path or query id is not a positive integer.
- `404` when the movie or the actor does not exist.
- `500` with `{ "message": "Internal server error" }` when DynamoDB fails. The error is written to CloudWatch and the response body stays a message.

#### 3. Authentication on GET

Both GET methods use a request authorizer. It reads the `token` cookie set by `POST /auth/signin`, verifies the Cognito ID token, and passes the Cognito username to the handler. A missing or invalid token is denied.

Each app handler logs one line, username then path and query, for example `doconnor   /movies/1234/roles`.

Sign-in, against the Auth API URL printed as `AuthApiUrl`:

1. `POST /auth/signup` with `{ "username", "password", "email" }`.
2. `POST /auth/confirm_signup` with `{ "username", "code" }` using the emailed code.
3. `POST /auth/signin` with `{ "username", "password" }`. Call GET with the header `Cookie: token=<token from the response>`.
4. `POST /auth/signout` clears that cookie.

#### 4. POST, happy path

`POST /movies/roles` accepts `{ "movieId", "actorId", "roleName", "roleDescription" }`. A transaction checks that the movie and actor exist, then writes the role. Success is `201` with `{ "message": "Role added", "data": { ... } }`.

#### 5. Error handling on POST

- `400` when the body is not a JSON object, an id is invalid, or a role name or description is empty.
- `404` when the movie or the actor does not exist.
- `409` when that actor already has a role in the movie.
- `500` uses the same message body as GET.

#### 6. API key on POST

`POST /movies/roles` requires an API key. API Gateway creates the key and a usage plan when `AppApiStack` is deployed and the stack outputs `AdminApiKeyId`. GET stays on the Cognito cookie. A request made with the key is logged as `admin`.

Read the key value from the output id:

```
aws apigateway get-api-key --api-key <AdminApiKeyId> --include-value --region <region>
```

Send it as the header `x-api-key: <value>`.

#### 7. Further error cases

- An id must be a safe positive integer. `0`, `01`, `12.5`, and a value above `Number.MAX_SAFE_INTEGER` are `400`. Surrounding spaces are trimmed, so `" 1234 "` is `1234`. The same rule covers path parameters, query parameters and JSON body ids.
- `GET /movies/{movieID}/roles?actor=` returns `404` when that actor does not exist and `200` with `"data": []` when the actor exists but has no role in the movie.
- `GET /actors/{actorID}?movie=` still returns the profile without `roleDescription` when the movie exists and the actor has no role in it.
- A base64-encoded POST body is decoded before it is parsed. A body that is still not a JSON object stays `400`.

#### 8. Shared helpers

- `getItem` in `lambdas/shared/db.ts` is the single GetItem call used by both GET handlers.
- `parseId`, `optionalId`, and `idFromBody` in `lambdas/shared/model.ts` parse path, query and body ids.
- `serverError` in `lambdas/shared/http.ts` is the shared `500` response. The POST transaction checks still return `404` or `409` before that helper.

### Sample data

`AppApiStack` writes the seed items once, when the stack is created.

| Id | Record |
| --- | --- |
| 1234 | The Shawshank Redemption |
| 1235 | The Dark Knight |
| 1236 | Se7en |
| 4321 | Morgan Freeman |
| 4322 | Tim Robbins |
| 4323 | Christian Bale |
| 4324 | Heath Ledger |
| 4325 | Brad Pitt |

Checks that match the later commits:

- Movie `1234` returns Red (actor `4321`) and Andy Dufresne (actor `4322`).
- Movie `1234` with `?actor=4321` returns only Red.
- Movie `1234` with `?actor=9999` is `404`, because that actor does not exist.
- Movie `1235` with `?actor=4322` is `200` and `"data": []`, because Tim Robbins is not in The Dark Knight.

### Deploy

```
npm install
npx cdk deploy --all
```

The Auth API URL is the `AuthApiUrl` output of `CognitoStack`. The App API stage name is `dev`. Use the account region configured for the AWS CLI (this project was deployed to `eu-north-1`).

Remove both stacks with `npx cdk destroy --all`.

__Completion Date:__ 10/11/26, midnight.

__CA mark:__ 45%.

__Deliverables:__

+ A text file (serverless-assignment.txt) containing:
   + The URL of the GitHub repository. 
   + The URL of the YouTube video demonstrating the API.

+ Upload the text file using [this Moodle link][moodle].

__Notes:__
+ To avoid plagiarism, you must set your GitHub repository visibility to PRIVATE. Shortly after the completion deadline, you will be requested to set it to public visibility to enable assessment.
+ Your repo's Git log __must have__ a clear, understandable, and coherent history of the work on this assignment. Each commit message must summarise the work performed (What task were you working on?) at each stage. __Failure to comply__ with this requirement will result in a minimal grade being awarded ( 20%-).

### Detailed Specification.

#### App API.

The Web API should support the following endpoints:

+ GET /movies/{movieID}/roles?[actor=actorID] - Get details of all roles for the specified movie. 
   + Support an optional query string parameter that specifies an actor ID, e.g. ?actor=4321. Only the role played by that actor in the movie should now be returned, if relevant.
+ GET /actors/{actorID}?[movie=movieID] - Return the specified actor's profile (DOB, bio, etc).
   + Support an optional query string parameter that specifies a movie ID. The response should now also include the description of the actor's role in the specified movie, if relevant. 
+ POST /movies/roles - add a movie role.

#### Data Model.
This application's domain data model comprises two entities, Movie and Actor, and one relationship, Role. The attributes of these data types are as follows:
+ Movie:
   + movie ID - number.
   + title - string.
   + release date - string.
   + overview - string.

+ Actor:
   + actor ID - number.
   + name - string.
   + date of birth - string.
   + bio - string.

+ Role:
   + movie ID - number.
   + actor ID - number.
   + role name - string.
   + role description - string.

#### DynamoDB table design.

The application's database will follow the *Single-table* design pattern. This means:
+ One table stores all the data (movies, actors and roles).
+ A table item could represent an entity (e.g. movie) or a relationship between entities (e.g. role). 

The table’s partition and sort keys contain entity IDs, and prefixes will be used to distinguish between the item types as follows: 

+ Movie - PK = m#movieID, SK = m#movieID.
+ Actor - PK = a#actorID, SK = a#actorID.
+ Role - PK = m#movieID, SK = a#actorID.

Sample table items are as follows:
+ A movie:
   + m#1234 | m#1234 | 1234 | The Shawshank Redemption | 05-03-1995 | A banker convicted of uxoricide forms a friendship over a quarter century with a hardened convict …
+ Actor:
   + a#4321 | a#4321 | 4321 | Morgan Freeman | 01-06-1937 |  An American actor, producer, and narrator. In a career spanning six decades, he has received numerous accolades, including an Academy Award and a Golden Globe Award, as well as ........
+ Role:
    + m#1234 | a#4321 | 1234 | 4321 | Ellis Boyd "Red" Redding  |  Serves as the film's narrator, deuteragonist, and emotional anchor. As a seasoned inmate serving a life sentence, Red is the "man who can get things," a contraband smuggler who becomes the best friend and protector of ....

#### Stack Architecture.

A multi-stack architecture should be used: one stack encapsulating user authentication requirements (Cognito stack), and a separate stack containing the application Web API (App API stack).

#### Authentication. 

Two forms of authentication will be used:
+ Username and password credentials for users.
+ An API key for the administrator.

The Cognito service manages user credentials. The Cognito stack should include a separate web API (the Auth API) to handle user authentication requests. It should allow users to self-register, log in, and log out. 

The administrator authenticates using an API key instead of a username and password. The key is generated at deployment time by the API Gateway service in the App API stack.

#### Authorisation.

Only authenticated users can perform HTTP GET requests, while an authenticated administrator can perform POST requests.

#### Logging.

The application should log all user requests to CloudWatch logs. A log entry should specify the request path and the Cognito username of the requester, e.g.

+  doconnor   /movies/1234/roles
+  jbloggs    /actors/4321?movie=1234

[The associated log streams are used for analysis, but this functionality is outside the scope of this assignment.] 

#### Grading spectrum.

+ 40-50% - All GET requests.

+ 51-65% - POST requests (no auth). Reasonable error handling.

+ 66-85% - Excellent error handling. API key authentication.

+ 86%+ - Excellent coding standard (aligned with provided code).

#### Advice

+ Responses should never return database items; they should only return model data, e.g. Actor, Role. Make use of the utility methods in `shared/model.ts`.

+ Responses with data should use the following structure:
~~~json
{
   "data":
     // model data  
} 
~~~

+ Query string and path parameters are interpreted as strings by the HTTP protocol, e.g. 1547 --> "1547". Consequently, you are never guaranteed that a parameter is a number even when it should be one.

+ Consider using the following implementation strategy:
     1. Complete GET request functionality, assuming the 'happy path'.
     1. Add error handling to GET processing.
     1. Ensure authentication works for GETs.
     1. Repeat the above steps for POST (excluding auth).
     1. Solve the API key requirement.
     1. Consider other error cases.
     1. Refactor at each stage to improve code quality, e.g. DRY, variable naming, redundant debugging code, etc.

[moodle]: https://moodle.setu.ie/mod/assign/view.php?id=4868989