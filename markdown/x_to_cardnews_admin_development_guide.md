# X 게시물 수집 → 어드민 승인 → 번역/초안 생성 → 카드뉴스 자동 생성 개발 문서

## 0. 문서 목적

이 문서는 Codex로 개발을 진행하기 위한 개발 기준 문서다.

목표는 X/Twitter의 특정 기자 계정 게시물을 자동 감지하고, 원문만 먼저 어드민에게 알린 뒤, 관리자가 Accept한 게시물에 대해서만 LLM 번역·요약·웹 게시물 초안·카드뉴스 초안·이미지 후보 검색·카드뉴스 렌더링을 실행하는 시스템을 만드는 것이다.

비용 절감을 위해 수집 직후에는 LLM을 호출하지 않는다.

카드뉴스에는 주제와 관련된 이미지가 반드시 포함되어야 하며, 이미지는 라이선스와 출처 정보를 함께 관리한다.

---

## 1. 핵심 목표

```text
1. 특정 X 계정의 게시물을 자동 수집한다.
2. 수집된 원문을 DB에 저장한다.
3. 새 원문이 들어오면 LLM 없이 관리자에게 알림을 보낸다.
4. 어드민 페이지에서 관리자가 원문과 출처를 확인한다.
5. 관리자가 Accept한 게시물에 대해서만 LLM 번역, 요약, 태그, 게시물 유형을 생성한다.
6. Accept 이후 LLM이 웹 게시물과 카드뉴스 초안을 생성한다.
7. 관련 선수/구단 이미지를 자동 후보 추천한다.
8. 이미지의 라이선스, 작가, 출처 정보를 저장한다.
9. 카드뉴스 템플릿에 텍스트와 이미지를 넣어 PNG로 렌더링한다.
10. 관리자가 최종 수정 후 웹 게시 또는 인스타그램 업로드용으로 사용한다.
```

---

## 2. 전체 플로우

```text
[X Filtered Stream]
        ↓
[Raw Post 저장]
        ↓
[LLM 없는 새 원문 알림]
        ↓
[Admin Inbox 원문 표시]
        ↓
[관리자 Accept]
        ↓
[LLM 번역/요약]
        ↓
[LLM 콘텐츠 초안 생성]
        ↓
[엔티티 기반 이미지 후보 검색]
        ↓
[라이선스/출처 저장]
        ↓
[안전 이미지 자동 선택 또는 관리자 이미지 선택]
        ↓
[카드뉴스 템플릿 렌더링]
        ↓
[관리자 최종 승인]
        ↓
[웹 게시 / 이미지 다운로드]
```

---

## 3. 추천 기술 스택

## 3-1. MVP 추천 스택

```text
Frontend / Fullstack:
Next.js App Router

Language:
TypeScript

UI:
Tailwind CSS
shadcn/ui

Database:
PostgreSQL

ORM:
Prisma

Queue:
BullMQ
Redis

LLM:
OpenAI API Structured Outputs

X 데이터 수집:
X API Filtered Stream

이미지 검색:
Wikimedia Commons API
Unsplash API 또는 Pexels API

이미지 렌더링:
React 카드 템플릿
Playwright Screenshot

Storage:
Cloudflare R2 또는 AWS S3

알림:
Slack Webhook

Auth:
NextAuth 또는 Supabase Auth
```

---

## 3-2. MVP에서 우선순위

```text
1순위:
SourceAccount 등록 → X Filtered Stream 자동 수집 → LLM 없는 알림 → 관리자 Accept → 번역/요약 → 이미지 포함 카드뉴스 생성

2순위:
RawPost 수동 입력 fallback

3순위:
Wikimedia Commons 이미지 후보 자동 추천 및 안전 이미지 자동 선택

4순위:
카드뉴스 PNG 자동 렌더링

5순위:
인스타그램 자동 게시
```

초기에는 인스타그램 자동 게시까지 구현하지 않는다.

MVP에서는 카드뉴스 이미지와 캡션을 생성하고, 관리자가 직접 다운로드해서 업로드한다.

---

## 4. 핵심 정책

## 4-1. 자동 게시 금지

관리자가 승인하기 전까지는 어떤 콘텐츠도 외부에 게시하지 않는다.

```text
자동 수집: 허용
자동 새 원문 알림: 허용
Accept 전 자동 번역: 금지
Accept 전 자동 요약: 금지
Accept 전 자동 초안 생성: 금지
Accept 후 자동 번역: 허용
Accept 후 자동 요약: 허용
Accept 후 자동 초안 생성: 허용
Accept 후 자동 이미지 후보 추천: 허용
자동 외부 게시: 금지
```

---

## 4-2. LLM 비용 제어 정책

LLM은 비용이 발생하므로 아래 정책을 반드시 따른다.

```text
1. RawPost가 수집되거나 수동 입력되는 순간에는 LLM을 호출하지 않는다.
2. 새 RawPost 알림에는 원문 일부, 출처 계정, 원문 링크, 게시 시간만 사용한다.
3. 번역, 요약, 태그 추출, 게시물 유형 분류는 관리자가 Accept한 뒤에만 실행한다.
4. Reject 또는 Ignore된 RawPost에는 LLM 작업을 실행하지 않는다.
5. 이미 Accept 처리되어 번역이 완료된 RawPost는 중복으로 LLM을 호출하지 않는다.
6. 재생성 버튼을 누른 경우에만 LLM 재호출을 허용한다.
7. 모든 LLM 호출은 어떤 관리자 액션 또는 어떤 Queue 작업에서 발생했는지 로그로 남긴다.
```

---

## 4-3. 이미지 사용 정책

카드뉴스에는 이미지가 반드시 들어간다.

다만 이미지는 아래 정책에 따라 사용한다.

```text
1. 구글 이미지 검색 결과를 크롤링해서 사용하지 않는다.
2. X 게시물에 첨부된 이미지를 무단 저장해서 사용하지 않는다.
3. 구단 공식 홈페이지나 선수 SNS 이미지를 무단 사용하지 않는다.
4. Getty 워터마크가 있는 이미지를 사용하지 않는다.
5. 라이선스와 출처가 명확한 이미지만 후보로 제공한다.
6. 관리자가 승인한 이미지만 카드뉴스에 사용한다.
```

---

## 4-4. Wikimedia Commons 라이선스 필터 정책

Wikimedia Commons에서 이미지를 가져올 때는 다음 우선순위를 따른다.

```text
자동 후보 추천 허용:
1. No restrictions
2. Use with attribution

관리자 검토 필요:
3. Use with attribution and same license

기본 제외:
4. Other
5. All licenses
```

실제 시스템 내부 정책은 다음처럼 정의한다.

```ts
export type ImageLicenseSafety =
  | "SAFE_NO_RESTRICTIONS"
  | "SAFE_WITH_ATTRIBUTION"
  | "REVIEW_SAME_LICENSE"
  | "BLOCKED_OTHER"
  | "UNKNOWN";
```

---

## 5. 게시물 유형

수집된 X 게시물은 최종적으로 아래 세 가지 중 하나로 분류된다.

```text
GENERAL:
일반 게시물. 댓글 중심.

POLL:
논쟁형 게시물. 찬성/반대 투표 중심.

TODAY_DEBATE:
오늘의 토론 게시물. 실시간 토론방과 AI 분석 적용.
```

---

## 6. 데이터 모델

## 6-1. SourceAccount

감시할 X 계정 정보.

```prisma
model SourceAccount {
  id          String   @id @default(cuid())
  platform    String   // X
  handle      String   @unique
  displayName String?
  sportType   String   // PL, NBA, F1
  sourceTier  Int      // 1, 2, 3
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  rawPosts RawPost[]
}
```

---

## 6-2. RawPost

X에서 들어온 원문 게시물.

```prisma
model RawPost {
  id              String   @id @default(cuid())
  sourceAccountId String?
  externalPostId  String   @unique
  originalText    String
  originalUrl     String
  postedAt        DateTime
  language        String?
  rawJson         Json?
  status          RawPostStatus @default(NEW)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  sourceAccount   SourceAccount? @relation(fields: [sourceAccountId], references: [id])
  translation     TranslatedPost?
  articleDrafts   ArticleDraft[]
}

enum RawPostStatus {
  NEW
  NOTIFIED
  ACCEPTED
  TRANSLATING
  TRANSLATED
  REJECTED
  IGNORED
  ERROR
}
```

상태 의미:

```text
NEW:
수집 또는 수동 입력 직후. LLM 미사용 상태.

NOTIFIED:
관리자에게 새 원문 알림을 보낸 상태. LLM 미사용 상태.

ACCEPTED:
관리자가 원문을 확인하고 후속 LLM 작업 실행을 승인한 상태.

TRANSLATING / TRANSLATED:
Accept 이후 번역/요약 작업 중 또는 완료 상태.

REJECTED / IGNORED:
관리자가 제외한 상태. LLM 작업을 실행하지 않는다.
```

---

## 6-3. TranslatedPost

어드민 검수용 번역/요약 결과.

```prisma
model TranslatedPost {
  id                   String   @id @default(cuid())
  rawPostId            String   @unique
  translatedText       String
  oneLineSummary       String
  shortSummary         String?
  detectedTeams        String[]
  detectedPlayers      String[]
  detectedKeywords     String[]
  suggestedPostType    PostType
  suggestedRumorStatus String?
  riskFlags            String[]
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  rawPost RawPost @relation(fields: [rawPostId], references: [id])
}

enum PostType {
  GENERAL
  POLL
  TODAY_DEBATE
}
```

---

## 6-4. ArticleDraft

Accept 이후 생성되는 웹 게시물 초안.

```prisma
model ArticleDraft {
  id              String   @id @default(cuid())
  rawPostId       String
  postType        PostType
  title           String
  subtitle        String?
  summary         String
  body            String
  sourceName      String?
  sourceUrl       String
  rumorStatus     String?
  teamTags        String[]
  playerTags      String[]
  hashtags        String[]
  pollQuestion    String?
  pollAgreeText   String?
  pollDisagreeText String?
  status          DraftStatus @default(DRAFT)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  rawPost        RawPost @relation(fields: [rawPostId], references: [id])
  cardNewsDrafts CardNewsDraft[]
}

enum DraftStatus {
  DRAFT
  REVIEW
  APPROVED
  PUBLISHED
  ARCHIVED
}
```

---

## 6-5. ImageAsset

이미지 후보와 사용 이미지 정보를 저장한다.

```prisma
model ImageAsset {
  id                    String   @id @default(cuid())
  provider              ImageProvider
  providerAssetId       String?
  title                 String?
  imageUrl              String
  thumbnailUrl          String?
  sourcePageUrl         String?
  authorName            String?
  licenseName           String?
  licenseUrl            String?
  creditText            String
  licenseSafety         ImageLicenseSafety
  commercialUseAllowed  Boolean @default(false)
  modificationAllowed   Boolean @default(false)
  requiresAttribution   Boolean @default(true)
  requiresShareAlike    Boolean @default(false)
  hasIdentifiablePerson Boolean @default(false)
  hasLogoOrTrademark    Boolean @default(false)
  usageAllowed          Boolean @default(false)
  adminApproved         Boolean @default(false)
  tags                  String[]
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  cardSlides CardSlide[]
}

enum ImageProvider {
  WIKIMEDIA_COMMONS
  UNSPLASH
  PEXELS
  PIXABAY
  INTERNAL_ASSET
  ADMIN_UPLOAD
}

enum ImageLicenseSafety {
  SAFE_NO_RESTRICTIONS
  SAFE_WITH_ATTRIBUTION
  REVIEW_SAME_LICENSE
  BLOCKED_OTHER
  UNKNOWN
}
```

---

## 6-6. CardNewsDraft

카드뉴스 전체 초안.

```prisma
model CardNewsDraft {
  id              String   @id @default(cuid())
  articleDraftId  String
  title           String
  caption         String
  instagramHashtags String[]
  status          CardNewsStatus @default(DRAFT)
  renderedImageUrls String[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  articleDraft ArticleDraft @relation(fields: [articleDraftId], references: [id])
  slides       CardSlide[]
}

enum CardNewsStatus {
  DRAFT
  IMAGE_PENDING
  READY_TO_RENDER
  RENDERED
  APPROVED
  PUBLISHED
}
```

---

## 6-7. CardSlide

카드뉴스 각 슬라이드.

```prisma
model CardSlide {
  id              String   @id @default(cuid())
  cardNewsDraftId String
  order           Int
  templateType    String
  headline        String
  body            String?
  footnote        String?
  imageAssetId    String?
  renderedImageUrl String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  cardNewsDraft CardNewsDraft @relation(fields: [cardNewsDraftId], references: [id])
  imageAsset    ImageAsset? @relation(fields: [imageAssetId], references: [id])
}
```

---

## 7. API 라우트 설계

## 7-1. SourceAccount / X 수집

```text
GET /api/admin/source-accounts
POST /api/admin/source-accounts
PATCH /api/admin/source-accounts/:id
DELETE /api/admin/source-accounts/:id
POST /api/admin/source-accounts/:id/test-fetch
POST /api/workers/x-stream/webhook 또는 Worker 프로세스
```

Phase 1부터 SourceAccount 목록을 기준으로 X 게시물을 자동 수집한다.

---

## 7-2. 어드민 Inbox

```text
GET /api/admin/raw-posts
POST /api/admin/raw-posts
GET /api/admin/raw-posts/:id
POST /api/admin/raw-posts/:id/accept
POST /api/admin/raw-posts/:id/reject
POST /api/admin/raw-posts/:id/ignore
```

주의:

```text
- POST /api/admin/raw-posts는 수동 입력 fallback이다.
- POST /api/admin/raw-posts/:id/accept는 이후 LLM/이미지/렌더링 Queue를 시작하는 유일한 기본 진입점이다.
- Accept 전에는 translate API를 직접 호출하지 않는다.
```

---

## 7-3. 초안 생성

```text
POST /api/admin/article-drafts/:id/regenerate
PATCH /api/admin/article-drafts/:id
POST /api/admin/article-drafts/:id/approve
POST /api/admin/article-drafts/:id/publish
```

---

## 7-4. 카드뉴스

```text
GET /api/admin/card-news/:id
PATCH /api/admin/card-news/:id
POST /api/admin/card-news/:id/regenerate
POST /api/admin/card-news/:id/render
POST /api/admin/card-news/:id/approve
```

---

## 7-5. 이미지 후보

```text
GET /api/admin/image-assets/search?query=son%20heung%20min
POST /api/admin/image-assets/import
POST /api/admin/image-assets/upload
PATCH /api/admin/image-assets/:id/approve
PATCH /api/admin/card-slides/:id/select-image
```

---

## 8. LLM 작업 설계

LLM 작업은 반드시 `RawPost.status === ACCEPTED` 이후에만 실행한다.

Accept 이전 단계에서 허용되는 작업:

```text
- X 게시물 수집
- RawPost 저장
- 중복 검사
- 원문 기반 알림
- Admin Inbox 원문 표시
- Reject / Ignore / Hold
```

Accept 이후 단계에서만 허용되는 작업:

```text
- 번역/요약
- 태그/엔티티 추출
- 게시물 유형 분류
- 웹 게시물 초안 생성
- 카드뉴스 초안 생성
- 이미지 검색 쿼리 생성
```

## 8-1. 번역/요약 작업

입력:

```json
{
  "sourceHandle": "FabrizioRomano",
  "sourceTier": 1,
  "originalText": "Manchester United are monitoring...",
  "originalUrl": "https://x.com/..."
}
```

출력 JSON Schema:

```ts
export type TranslationResult = {
  translatedText: string;
  oneLineSummary: string;
  shortSummary: string;
  detectedTeams: string[];
  detectedPlayers: string[];
  detectedKeywords: string[];
  suggestedPostType: "GENERAL" | "POLL" | "TODAY_DEBATE";
  suggestedRumorStatus:
    | "Monitoring"
    | "Interest"
    | "Contact"
    | "Talks"
    | "Advanced"
    | "Here We Go"
    | "Official"
    | "Denied"
    | "Collapsed"
    | "Unknown";
  riskFlags: string[];
};
```

주의:

```text
- 확정되지 않은 루머를 확정처럼 번역하지 않는다.
- 원문의 뉘앙스를 유지한다.
- 자극적인 제목을 만들지 않는다.
- 한국어 문장은 짧고 명확하게 만든다.
```

---

## 8-2. 게시물 초안 생성 작업

Accept 후 실행한다.

출력 JSON Schema:

```ts
export type ArticleDraftResult = {
  postType: "GENERAL" | "POLL" | "TODAY_DEBATE";
  title: string;
  subtitle?: string;
  summary: string;
  body: string;
  rumorStatus: string;
  teamTags: string[];
  playerTags: string[];
  hashtags: string[];
  pollQuestion?: string;
  pollAgreeText?: string;
  pollDisagreeText?: string;
};
```

---

## 8-3. 카드뉴스 초안 생성 작업

출력 JSON Schema:

```ts
export type CardNewsResult = {
  title: string;
  caption: string;
  instagramHashtags: string[];
  slides: {
    order: number;
    templateType:
      | "TITLE_IMAGE"
      | "SUMMARY"
      | "AGREE_DISAGREE"
      | "SOURCE_STATUS"
      | "CTA_COMMENT"
      | "CTA_POLL"
      | "CTA_DEBATE";
    headline: string;
    body?: string;
    footnote?: string;
    recommendedVisualQuery: string;
  }[];
};
```

---

## 9. 이미지 후보 추천 설계

## 9-1. 이미지 검색 쿼리 생성

LLM이 추출한 엔티티를 기반으로 이미지 검색 쿼리를 만든다.

예시:

```text
mainSubject: Son Heung-min
team: Tottenham Hotspur
contentType: transfer_rumor
```

검색 우선순위:

```text
1. 내부 Asset DB에서 Son Heung-min 검색
2. Wikimedia Commons에서 "Son Heung-min footballer" 검색
3. Wikimedia Commons에서 "Tottenham Hotspur Stadium" 검색
4. Unsplash/Pexels에서 "football stadium" 검색
5. 내부 기본 축구 배경 이미지 사용
```

---

## 9-2. 이미지 Provider 우선순위

```text
1. INTERNAL_ASSET
2. WIKIMEDIA_COMMONS - No restrictions
3. WIKIMEDIA_COMMONS - Use with attribution
4. UNSPLASH / PEXELS - 분위기 이미지
5. WIKIMEDIA_COMMONS - Use with attribution and same license
6. ADMIN_UPLOAD
```

단, `Use with attribution and same license`는 자동 확정하지 않고 관리자 검토가 필요하다.

---

## 9-3. Wikimedia Commons 메타데이터 저장

이미지를 가져올 때 반드시 저장할 값:

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

카드뉴스에는 짧은 출처를 표기하고, 웹 상세에는 전체 출처를 표기한다.

카드뉴스 하단 예시:

```text
Info: @FabrizioRomano · Image: Wikimedia Commons / CC BY 4.0
```

웹 상세 예시:

```text
정보 출처:
Fabrizio Romano, 원문 링크

이미지 출처:
Photo by Author Name, CC BY 4.0, via Wikimedia Commons
License: https://creativecommons.org/licenses/by/4.0/
```

---

## 10. 카드뉴스 렌더링 설계

## 10-1. 렌더링 방식

MVP에서는 Playwright 기반 렌더링을 사용한다.

```text
1. React 카드뉴스 템플릿 페이지 생성
2. slideId 또는 cardNewsDraftId로 데이터 조회
3. 1080x1080 또는 1080x1350 비율로 렌더링
4. Playwright로 스크린샷 캡처
5. PNG를 Storage에 업로드
6. renderedImageUrl 저장
```

---

## 10-2. 카드뉴스 규격

```text
Instagram Feed 기본:
1080 x 1350

정사각 카드:
1080 x 1080

MVP 추천:
1080 x 1350
```

---

## 10-3. 템플릿 규칙

```text
1. 모든 슬라이드에는 이미지 또는 이미지성 배경이 들어가야 한다.
2. 모든 슬라이드 하단에는 정보 출처 또는 이미지 출처가 들어간다.
3. 선수 실사 이미지가 없으면 스포츠 배경 이미지와 타이포그래피로 대체한다.
4. 구단 공식 로고는 기본적으로 사용하지 않는다.
5. 구단명, 약어, 컬러, 자체 그래픽으로 표현한다.
```

---

## 11. 어드민 화면 설계

## 11-1. Raw Post Inbox

목적:
수집된 X 게시물 원문을 LLM 사용 전에 빠르게 확인하고, 후속 자동 생성 플로우를 실행할지 결정한다.

표시 항목:

```text
- 출처 계정
- 원문 게시 시간
- 원문 텍스트
- 원문 링크
- 수집 상태
- 알림 발송 여부
- Accept / Reject / Hold 버튼
```

Accept 전에는 아래 항목을 표시하지 않는다.

```text
- 번역문
- 1줄 요약
- 관련 선수/구단
- 추천 게시물 유형
- 추천 루머 상태
- 위험 플래그
```

위 항목은 Accept 이후 LLM 작업이 완료된 게시물에만 표시한다.

---

## 11-2. Article Draft Editor

목적:
Accept 후 생성된 웹 게시물 초안을 수정한다.

필드:

```text
- 제목
- 부제목
- 요약
- 본문
- 게시물 유형
- 루머 상태
- 팀 태그
- 선수 태그
- 해시태그
- 찬성/반대 질문
- 찬성 근거
- 반대 근거
```

---

## 11-3. Card News Editor

목적:
카드뉴스 슬라이드와 이미지를 최종 편집한다.

기능:

```text
- 슬라이드별 텍스트 수정
- 이미지 후보 목록 표시
- 이미지 라이선스 정보 표시
- 출처 문구 미리보기
- 이미지 선택
- 직접 이미지 업로드
- 카드뉴스 재렌더링
- PNG 미리보기
- 다운로드
```

이미지 후보 카드에는 반드시 아래 정보를 표시한다.

```text
- 이미지 미리보기
- Provider
- Author
- License
- Credit Text
- 상업적 사용 가능 여부
- 수정 가능 여부
- 동일 라이선스 요구 여부
- 사용 / 검토 필요 / 사용 금지 상태
```

---

## 12. Queue 작업 목록

```text
collect-x-posts
save-raw-post
send-new-raw-post-notification
translate-raw-post
create-article-draft
create-card-news-draft
search-image-candidates
select-safe-image-candidates
render-card-news-images
send-admin-notification
```

Queue 실행 조건:

```text
수집 직후 자동 실행:
- collect-x-posts
- save-raw-post
- send-new-raw-post-notification

관리자 Accept 이후 자동 실행:
- translate-raw-post
- create-article-draft
- create-card-news-draft
- search-image-candidates
- select-safe-image-candidates
- render-card-news-images
```

---

## 13. 상태 전이

## 13-1. RawPost 상태

```text
NEW
→ NOTIFIED
→ ACCEPTED / REJECTED / IGNORED

ACCEPTED
→ TRANSLATING
→ TRANSLATED
```

---

## 13-2. ArticleDraft 상태

```text
DRAFT
→ REVIEW
→ APPROVED
→ PUBLISHED
```

---

## 13-3. CardNewsDraft 상태

```text
DRAFT
→ IMAGE_PENDING
→ READY_TO_RENDER
→ RENDERED
→ APPROVED
→ PUBLISHED
```

---

## 14. 알림 정책

새 게시물이 들어오면 LLM 없이 Slack으로 관리자에게 알림을 보낸다.

알림 예시:

```text
[새 PL 루머 감지]

출처: @FabrizioRomano
원문 일부: Manchester United are monitoring...
게시 시간: 2026-05-17 20:10
LLM 상태: 미실행

어드민에서 확인하기:
/admin/raw-posts/{id}
```

Accept 전에는 요약, 추천 유형, 루머 상태, 오늘의 토론 후보 여부를 알림에 포함하지 않는다.

Accept 이후 LLM 작업이 완료되면 별도 완료 알림을 보낼 수 있다.

```text
[카드뉴스 초안 생성 완료]

출처: @FabrizioRomano
요약: 맨유가 새로운 미드필더 후보를 검토 중입니다.
추천 유형: GENERAL
카드뉴스 상태: RENDERED

어드민에서 검수하기:
/admin/card-news/{id}
```

---

## 15. 구현 순서

## Phase 1. X 자동 수집 + Accept 이후 카드뉴스 자동 생성 MVP

```text
1. 어드민 로그인
2. SourceAccount 등록/관리 화면
3. X Filtered Stream 또는 주기적 fetch Worker 연결
4. SourceAccount 목록의 신규 게시물 자동 수집
5. RawPost 중복 검사 후 저장
6. LLM 없이 새 원문 알림 발송
7. Admin Inbox에서 원문 확인
8. Accept / Reject / Hold
9. Accept한 RawPost에 대해서만 LLM 번역/요약 실행
10. Article Draft 생성
11. Card News Draft 생성
12. 이미지 후보 검색 및 안전 후보 선택
13. 카드뉴스 PNG 렌더링
```

목표:
등록된 X 계정이 게시글을 올리면 자동으로 수집되고, 관리자가 원문을 Accept한 경우에만 비용이 발생하는 LLM/이미지/렌더링 플로우가 실행되어 이미지가 포함된 카드뉴스 초안까지 생성된다.

---

## Phase 2. 카드뉴스 편집 품질 개선

```text
1. Card News Editor 고도화
2. 슬라이드별 텍스트 수정
3. 이미지 후보 교체
4. 출처 문구 수정
5. 카드뉴스 재렌더링
6. 다운로드 UX 개선
```

---

## Phase 3. 운영 안정화

```text
1. Queue 재시도 정책
2. X Stream 재연결 정책
3. LLM 비용/호출 로그 대시보드
4. 이미지 라이선스 감사 로그
5. Slack 알림 세분화
```

---

## Phase 4. 웹 게시

```text
1. Article 공개 페이지
2. 릴스형 피드 데이터 연결
3. 일반/논쟁형/오늘의 토론 게시물 타입 반영
4. 댓글/투표/토론방 연결
```

---

## Phase 5. 인스타그램 자동 게시 검토

```text
1. Instagram Graph API 권한 검토
2. 자동 게시 정책 검토
3. 관리자 최종 승인 이후에만 게시
4. 게시 실패/중복 게시 방지
```

---

## 16. Codex 작업 지시용 TODO

아래 순서대로 Codex에게 작업을 요청한다.

```text
1. Prisma schema에 SourceAccount, RawPost, TranslatedPost, ArticleDraft, CardNewsDraft, CardSlide, ImageAsset 모델을 추가하고 RawPostStatus에 NEW, NOTIFIED, ACCEPTED 상태를 반영해줘.

2. SourceAccount를 등록하고 관리할 수 있는 어드민 페이지와 API를 만들어줘.

3. SourceAccount 목록을 기반으로 X 게시물을 자동 수집하는 Worker를 만들어줘.

4. 수집된 RawPost를 중복 없이 저장하고, 새 원문 알림을 Slack으로 보내는 Queue를 만들어줘. 이 단계에서는 LLM을 호출하지 마.

5. Admin Inbox에서 RawPost 원문만 먼저 보여주고 Accept/Reject/Hold 버튼을 만들어줘.

6. Accept 버튼을 누르면 그때부터 RawPost 원문을 OpenAI API로 번역/요약해서 TranslatedPost로 저장하는 Queue를 만들어줘.

7. Accept 이후 ArticleDraft와 CardNewsDraft를 자동 생성하는 API 또는 Queue를 만들어줘.

8. Wikimedia Commons에서 이미지 후보를 검색하고 ImageAsset으로 저장하는 API를 만들어줘.

9. 안전한 이미지 후보를 카드뉴스 슬라이드에 자동 선택하고, 라이선스 정보를 저장해줘.

10. React 기반 카드뉴스 템플릿 페이지를 만들고, CardSlide 데이터를 받아 1080x1350 카드로 렌더링해줘.

11. Playwright로 카드뉴스 템플릿을 PNG로 캡처하고 Storage에 업로드하는 API를 만들어줘.

12. 렌더링된 카드뉴스 이미지를 어드민에서 미리보기하고 다운로드할 수 있게 만들어줘.

13. RawPost를 수동으로 생성할 수 있는 어드민 페이지와 API를 fallback 기능으로 유지해줘.
```

---

## 17. 개발 시 주의사항

```text
1. 원문 게시물 ID 기준으로 중복 저장을 막는다.
2. Accept 전에는 LLM을 호출하지 않는다.
3. LLM 결과는 항상 JSON Schema로 검증한다.
4. LLM 결과를 바로 게시하지 않는다.
5. 관리자가 수정 가능한 구조를 유지한다.
6. 이미지 출처와 라이선스는 반드시 DB에 저장한다.
7. 카드뉴스에 이미지 출처를 표시한다.
8. 같은 라이선스 요구 이미지의 경우 관리자 검토 상태로 둔다.
9. 공식 구단 로고와 선수 SNS 이미지를 무단 사용하지 않는다.
10. 에러 발생 시 RawPost 또는 Draft 상태를 ERROR로 남긴다.
11. Accept 전 Slack 알림에는 LLM 요약을 넣지 않는다.
12. Accept 전 Slack 알림에는 원문 일부와 어드민 링크를 중심으로 보낸다.
13. LLM 호출 횟수와 트리거 RawPost ID를 로그로 남긴다.
```

---

## 18. 최종 MVP 정의

MVP 완료 기준은 다음과 같다.

```text
1. 관리자가 감시할 X 계정을 등록할 수 있다.
2. 등록된 X 계정의 신규 게시물이 자동 수집된다.
3. 수집된 원문은 DB에 저장되고 관리자에게 LLM 없이 알림이 간다.
4. 관리자가 원문만 보고 Accept/Reject/Hold할 수 있다.
5. Accept 전에는 번역, 요약, 초안 생성 LLM 호출이 발생하지 않는다.
6. Accept 시 번역/요약, 웹 게시물 초안, 카드뉴스 초안이 자동 생성된다.
7. 카드뉴스 슬라이드마다 이미지 후보가 자동 추천되거나 안전 후보가 선택된다.
8. 이미지 후보에는 출처와 라이선스가 표시된다.
9. 카드뉴스가 1080x1350 PNG로 렌더링된다.
10. 관리자가 PNG를 미리보고 다운로드할 수 있다.
11. 관리자가 X 원문을 수동 입력할 수 있는 fallback이 있다.
```

---

## 19. 한 줄 요약

> 등록된 X 계정의 게시물을 자동 수집하고, 관리자가 원문을 Accept한 게시물에 대해서만 LLM과 이미지/렌더링 작업을 실행해 비용을 통제하면서 카드뉴스 초안까지 자동 생성하는 어드민 중심 콘텐츠 자동화 시스템을 만든다.
