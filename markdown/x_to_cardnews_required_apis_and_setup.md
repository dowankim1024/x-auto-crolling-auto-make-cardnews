# X 카드뉴스 어드민 개발 전 API 및 준비사항 정리

작성일: 2026-05-17

원본 기준 문서: `markdown/x_to_cardnews_admin_development_guide.md`

이 문서는 실제 개발을 시작하기 전에 준비해야 할 외부 API, 내부 API 설계, 환경변수, 계정/권한, 의존성을 정리한 체크리스트다.

---

## 1. 우선순위 요약

### Phase 1 MVP에 바로 필요한 것

```text
1. PostgreSQL 데이터베이스
2. Prisma
3. OpenAI API
4. 어드민 인증 방식
5. RawPost 수동 입력/번역/승인/초안 생성용 내부 API
```

Phase 1은 X 자동 수집 없이 관리자가 원문을 직접 입력해서 전체 플로우를 검증하는 단계다.

### Phase 2~3에서 필요한 것

```text
1. Wikimedia Commons API
2. 이미지 저장 정책
3. Playwright
4. Cloudflare R2 또는 AWS S3
5. 카드뉴스 렌더링/다운로드용 내부 API
```

### Phase 4 이후 필요한 것

```text
1. X API
2. Redis
3. BullMQ
4. Slack Webhook
5. SourceAccount 관리 및 X Filtered Stream Worker
```

---

## 2. 외부 API 및 서비스

## 2-1. OpenAI API

목적:

```text
- X 원문 번역
- 한 줄 요약/짧은 요약 생성
- 선수/구단/키워드 추출
- 게시물 유형 분류
- 웹 게시물 초안 생성
- 카드뉴스 슬라이드 초안 생성
- 이미지 검색 쿼리 생성
```

필요 항목:

```text
- OpenAI API Key
- Structured Outputs 지원 모델 선택
- JSON Schema 검증 로직
- 사용량/비용 제한 정책
- 실패 시 재시도 및 ERROR 상태 저장 정책
```

예상 환경변수:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
```

개발 시 주의:

```text
- LLM 결과는 반드시 JSON Schema로 검증한다.
- 루머를 확정처럼 번역하지 않도록 시스템 프롬프트를 분리한다.
- LLM 결과를 바로 게시하지 않고 반드시 관리자 검수 단계를 거친다.
```

---

## 2-2. X API

목적:

```text
- 특정 기자/소스 계정 게시물 자동 수집
- Filtered Stream 기반 신규 게시물 감지
- 원문 URL, 게시 시간, 작성자, 게시물 ID 저장
```

필요 항목:

```text
- X Developer 계정
- X API App
- Bearer Token
- Filtered Stream 접근 권한
- 감시할 계정 목록
- stream rule 생성/조회/삭제 정책
```

예상 환경변수:

```env
X_BEARER_TOKEN=
X_API_BASE_URL=https://api.x.com
```

MVP 판단:

```text
Phase 1에서는 필수 아님.
수동 입력 기반 플로우가 안정화된 뒤 Phase 4에서 붙인다.
```

개발 시 주의:

```text
- externalPostId 기준으로 중복 저장을 막는다.
- X 게시물 첨부 이미지를 무단 저장하거나 카드뉴스 이미지로 사용하지 않는다.
- Stream 장애 시 재연결/재시도 정책이 필요하다.
```

---

## 2-3. Wikimedia Commons API

목적:

```text
- 선수/구단/장소 관련 이미지 후보 검색
- 이미지 원본 URL/썸네일 URL 조회
- 작가, 라이선스, 출처 페이지 정보 저장
- 라이선스 안전성 분류
```

필요 항목:

```text
- 별도 API Key 없이 시작 가능
- User-Agent 정책 확인
- 이미지 검색 쿼리 정책
- 라이선스 매핑 정책
```

예상 환경변수:

```env
WIKIMEDIA_API_BASE_URL=https://commons.wikimedia.org/w/api.php
WIKIMEDIA_USER_AGENT=
```

저장해야 할 메타데이터:

```text
- imageUrl
- thumbnailUrl
- sourcePageUrl
- authorName
- licenseName
- licenseUrl
- creditText
- licenseSafety
- commercialUseAllowed
- modificationAllowed
- requiresAttribution
- requiresShareAlike
```

라이선스 처리:

```text
자동 후보 추천 허용:
- SAFE_NO_RESTRICTIONS
- SAFE_WITH_ATTRIBUTION

관리자 검토 필요:
- REVIEW_SAME_LICENSE

기본 제외:
- BLOCKED_OTHER
- UNKNOWN
```

---

## 2-4. Unsplash / Pexels / Pixabay

목적:

```text
- 선수 실사 이미지가 없을 때 사용할 스포츠/경기장/분위기 이미지 후보 검색
- 카드뉴스 배경 이미지 대체 후보 제공
```

필요 항목:

```text
- 사용할 Provider 결정
- API Key 발급
- 각 Provider의 상업적 사용/수정/출처 표기 정책 확인
- 스포츠 인물/구단명 검색 결과의 적합성 검수 정책
```

예상 환경변수:

```env
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=
PIXABAY_API_KEY=
```

MVP 판단:

```text
처음에는 Wikimedia Commons와 내부 기본 이미지로 시작해도 된다.
Unsplash/Pexels/Pixabay는 대체 이미지 품질이 부족할 때 추가한다.
```

---

## 2-5. Cloudflare R2 또는 AWS S3

목적:

```text
- 렌더링된 카드뉴스 PNG 저장
- 관리자 업로드 이미지 저장
- 내부 기본 배경 이미지 저장
- 다운로드 URL 제공
```

필요 항목:

```text
- Cloudflare R2 또는 AWS S3 중 하나 선택
- Bucket 생성
- Access Key / Secret Key
- Public URL 또는 signed URL 정책
- 업로드 파일 크기 제한
- 이미지 삭제/교체 정책
```

예상 환경변수:

```env
STORAGE_PROVIDER=r2
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=
```

MVP 판단:

```text
Phase 3 카드뉴스 PNG 렌더링부터 필요하다.
Phase 1에서는 로컬 저장 또는 미구현 상태로 진행 가능하다.
```

---

## 2-6. Slack Webhook

목적:

```text
- 새 RawPost 수집 알림
- 오늘의 토론 후보 알림
- 번역/렌더링 실패 알림
```

필요 항목:

```text
- Slack Incoming Webhook URL
- 알림 채널
- 알림에 포함할 어드민 URL
```

예상 환경변수:

```env
SLACK_WEBHOOK_URL=
APP_BASE_URL=
```

MVP 판단:

```text
Phase 4 자동 수집부터 필요하다.
Phase 1에서는 필수 아님.
```

---

## 3. 인프라 및 런타임 의존성

## 3-1. PostgreSQL

목적:

```text
- SourceAccount
- RawPost
- TranslatedPost
- ArticleDraft
- CardNewsDraft
- CardSlide
- ImageAsset
```

예상 환경변수:

```env
DATABASE_URL=
```

결정 필요:

```text
- 로컬 개발 DB 방식: Docker PostgreSQL 또는 호스팅 DB
- 운영 DB 호스팅: Supabase, Neon, RDS 등
- 마이그레이션 적용 방식
```

---

## 3-2. Redis / BullMQ

목적:

```text
- translate-raw-post
- create-article-draft
- create-card-news-draft
- search-image-candidates
- render-card-news-images
- send-admin-notification
```

예상 환경변수:

```env
REDIS_URL=
```

MVP 판단:

```text
Phase 1에서는 서버 액션 또는 API에서 동기 처리로 시작할 수 있다.
작업 시간이 길어지거나 자동 수집을 붙이는 시점에는 Redis/BullMQ를 도입한다.
```

---

## 3-3. Playwright

목적:

```text
- React 카드뉴스 템플릿 페이지를 1080x1350 PNG로 캡처
- 렌더링 결과를 Storage에 업로드
```

필요 항목:

```text
- Playwright 패키지
- 브라우저 바이너리 설치
- 서버 환경에서 브라우저 실행 가능 여부 확인
- 렌더링 전용 Route 보호 정책
```

MVP 판단:

```text
Phase 3부터 필요하다.
```

---

## 3-4. Auth

후보:

```text
- NextAuth
- Supabase Auth
- 임시 Basic Auth 또는 단일 관리자 계정
```

결정 필요:

```text
- 관리자만 접근 가능한 페이지와 API 보호 방식
- 세션 저장 방식
- 운영 배포 도메인
```

예상 환경변수:

```env
AUTH_SECRET=
AUTH_TRUST_HOST=true
ADMIN_EMAIL=
```

MVP 판단:

```text
Phase 1부터 필요하다.
외부 게시 기능이 없더라도 원문/초안/이미지 승인 데이터가 있으므로 어드민 보호가 필요하다.
```

---

## 4. 내부 API 설계 체크리스트

## 4-1. Raw Post / Inbox

```text
GET  /api/admin/raw-posts
POST /api/admin/raw-posts
GET  /api/admin/raw-posts/:id
POST /api/admin/raw-posts/:id/translate
POST /api/admin/raw-posts/:id/accept
POST /api/admin/raw-posts/:id/reject
```

추가 필요:

```text
- 수동 입력용 POST /api/admin/raw-posts
- Hold 또는 Ignore 상태 변경 API
- 에러 재시도 API
```

---

## 4-2. Article Draft

```text
GET   /api/admin/article-drafts/:id
PATCH /api/admin/article-drafts/:id
POST  /api/admin/article-drafts/:id/regenerate
POST  /api/admin/article-drafts/:id/approve
POST  /api/admin/article-drafts/:id/publish
```

MVP 판단:

```text
publish는 실제 외부 게시가 아니라 내부 PUBLISHED 상태 변경 또는 웹 공개 처리로 제한한다.
```

---

## 4-3. Card News

```text
GET   /api/admin/card-news/:id
PATCH /api/admin/card-news/:id
POST  /api/admin/card-news/:id/regenerate
POST  /api/admin/card-news/:id/render
POST  /api/admin/card-news/:id/approve
```

추가 필요:

```text
GET /api/admin/card-news/:id/download
```

---

## 4-4. Image Assets

```text
GET   /api/admin/image-assets/search?query=
POST  /api/admin/image-assets/import
POST  /api/admin/image-assets/upload
PATCH /api/admin/image-assets/:id/approve
PATCH /api/admin/card-slides/:id/select-image
```

추가 필요:

```text
PATCH /api/admin/image-assets/:id/reject
GET   /api/admin/card-slides/:id/image-candidates
```

---

## 4-5. Source Accounts / X 수집

```text
GET    /api/admin/source-accounts
POST   /api/admin/source-accounts
PATCH  /api/admin/source-accounts/:id
DELETE /api/admin/source-accounts/:id
POST   /api/admin/source-accounts/:id/test-fetch
```

MVP 판단:

```text
Phase 4부터 구현한다.
```

---

## 5. 현재 프로젝트 상태 기준 추가 설치가 필요한 패키지

현재 `package.json`에는 아래만 설치되어 있다.

```text
- next 16.2.6
- react 19.2.4
- react-dom 19.2.4
- tailwindcss 4
- eslint
- typescript
```

개발 진행 시 추가 후보:

```text
- prisma
- @prisma/client
- openai
- zod
- next-auth 또는 Supabase Auth 관련 패키지
- bullmq
- ioredis
- playwright
- @aws-sdk/client-s3
- shadcn/ui 관련 패키지
- lucide-react
```

Next.js 관련 주의:

```text
이 프로젝트는 Next.js 16.2.6이다.
코드 작성 전 `node_modules/next/dist/docs/`의 App Router, Route Handler, Server Actions, 캐싱/렌더링 관련 문서를 확인해야 한다.
AGENTS.md에도 이 지침이 명시되어 있다.
```

---

## 6. 개발 전 결정해야 할 사항

```text
1. Phase 1에서 Queue 없이 동기 처리로 시작할지 여부
2. Auth를 NextAuth, Supabase Auth, 임시 관리자 인증 중 무엇으로 할지
3. PostgreSQL 호스팅 방식
4. 카드뉴스 PNG 저장소를 R2와 S3 중 무엇으로 할지
5. 이미지 Provider를 Wikimedia Commons만으로 시작할지 여부
6. OpenAI 모델과 비용 상한
7. 운영 배포 도메인과 APP_BASE_URL
8. 관리자 업로드 이미지의 라이선스 입력을 필수로 할지 여부
9. 카드뉴스 렌더링 비율을 1080x1350으로 고정할지 여부
10. 웹 게시 기능을 MVP에 포함할지, PNG 다운로드까지만 할지
```

권장 시작안:

```text
- Phase 1: PostgreSQL + Prisma + OpenAI + 간단한 어드민 인증
- Phase 2: Wikimedia Commons만 먼저 연동
- Phase 3: Playwright + R2 또는 S3
- Phase 4: X API + Redis/BullMQ + Slack
```

---

## 7. 최소 환경변수 템플릿

Phase 1 최소:

```env
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
AUTH_SECRET=
APP_BASE_URL=http://localhost:3000
```

Phase 2 이미지 검색:

```env
WIKIMEDIA_API_BASE_URL=https://commons.wikimedia.org/w/api.php
WIKIMEDIA_USER_AGENT=
```

Phase 3 렌더링/저장소:

```env
STORAGE_PROVIDER=r2
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=
```

Phase 4 자동 수집/알림:

```env
X_BEARER_TOKEN=
X_API_BASE_URL=https://api.x.com
REDIS_URL=
SLACK_WEBHOOK_URL=
```

선택 Provider:

```env
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=
PIXABAY_API_KEY=
```

---

## 8. 개발 시작 전 체크리스트

```text
[ ] PostgreSQL 연결 문자열 준비
[ ] OpenAI API Key 준비
[ ] OpenAI 모델 결정
[ ] 어드민 인증 방식 결정
[ ] Phase 1에서 Queue 도입 여부 결정
[ ] Wikimedia Commons만 먼저 사용할지 결정
[ ] Storage Provider 결정
[ ] X API는 Phase 4로 미룰지 확정
[ ] Slack 알림 도입 시점 결정
[ ] Next.js 16.2.6 문서 확인 후 Route/API 구현 시작
```

---

## 9. 결론

당장 개발을 시작하기 위한 필수 준비물은 `DATABASE_URL`, `OPENAI_API_KEY`, 어드민 인증 방식이다.

X API, Redis/BullMQ, Slack, Storage, Playwright는 전체 제품에는 필요하지만, Phase 1 수동 입력 기반 MVP를 먼저 만들 때는 나중 단계로 미뤄도 된다.
