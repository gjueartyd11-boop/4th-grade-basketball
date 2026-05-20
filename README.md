# 4학년 농구 리그전 - projectId 수정본

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

leagues / grade4-basketball

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
