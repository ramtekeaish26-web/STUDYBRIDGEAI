# STUDYBRIDGE Firestore Security Specification

## 1. Data Invariants
1. Every document under `/users/{userId}` and its subcollections belongs exclusively to `userId` (`uid == request.auth.uid`), with `email_verified == true`.
2. Every document ID (`lessonId`, `topicId`, `attemptId`, `sessionId`, `threadId`, `experimentId`) must match `^[a-zA-Z0-9_\-]+$` and stay `<= 128` characters.
3. No client may inject arbitrary shadow fields (`hasOnly`), oversized payloads (strict `.size()` limits on every string and list), or forged `createdAt` / `updatedAt` timestamps (`request.time`).
4. `uid` and `createdAt` are immutable after document creation (`incoming().uid == existing().uid` and `incoming().createdAt == existing().createdAt`).
5. Quiz attempts and focus sessions are append-only logs (no client-side tampering updates allowed).

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Cross-user profile read (`get /users/otherUser`) by signed-in user `alice`.
2. Unverified email write (`email_verified: false`) creating `/users/alice`.
3. Shadow field injection (`isAdmin: true`) on `/users/alice` create.
4. Spoofed `uid` (`uid: "bob"`) inside `/users/alice/lessons/l-1`.
5. Oversized `lessonId` (`a` repeated 200 times) or invalid characters (`../bad`) on `/users/alice/lessons/{lessonId}`.
6. Client-forged `createdAt` timestamp (not equal to `request.time`) on `/users/alice/focusSessions/fs-1`.
7. Cross-user `list` query on `/users/otherUser/mastery`.
8. Oversized string field (`summary` > 1500 chars) on `/users/alice/lessons/l-1`.
9. Unbounded array (`messages` > 60 items) on `/users/alice/tutorThreads/t-1`.
10. Mutating immutable `uid` or `createdAt` on `/users/alice/tutorThreads/t-1` update.
11. Out-of-range `scorePercent` (`150` or `-5`) on `/users/alice/quizAttempts/qa-1`.
12. Invalid `defaultLevel` enum (`"GodMode"`) on `/users/alice` update.
