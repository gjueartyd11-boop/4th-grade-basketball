# 6학년 배드민턴 리그전 - projectId 수정본

## 수정 내용
Firebase projectId를 아래 값으로 수정했습니다.

gen-lang-client-0225718076

## 링크
학생용:
https://배포주소.vercel.app

관리자용:
https://배포주소.vercel.app?admin=1

## Firebase 확인
Firestore Database에 저장되면 아래 문서가 생깁니다.

leagues / grade6-badminton

## Firestore Rules
테스트용으로 아래 규칙을 게시하세요.

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}


## 관리자 비밀번호

이 버전은 관리자 링크(`?admin=1`)로 접속해도 바로 입력창이 열리지 않습니다.
기본 비밀번호는 `1234`입니다.

비밀번호 변경 위치:
`src/App.jsx`

아래 줄을 원하는 비밀번호로 바꾸세요.

```js
const ADMIN_PASSWORD = "1234";
```
