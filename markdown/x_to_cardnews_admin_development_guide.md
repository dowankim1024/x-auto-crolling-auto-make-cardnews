# X 게시물 수집 → 번역 → 어드민 승인 → 카드뉴스 자동 생성 개발 문서

## 0. 문서 목적

이 문서는 Codex로 개발을 진행하기 위한 개발 기준 문서다.

목표는 X/Twitter의 특정 기자 계정 게시물을 감지하고, 해당 게시물을 번역·요약한 뒤, 어드민 페이지에서 관리자가 확인하고 승인하면 LLM을 통해 웹 게시물과 카드뉴스 초안을 자동 생성하는 시스템을 만드는 것이다.

카드뉴스에는 주제와 관련된 이미지가 반드시 포함되어야 하며, 이미지는 라이선스와 출처 정보를 함께 관리한다.

---

## 1. 핵심 목표

```text
1. 특정 X 계정의 게시물을 자동 수집한다.
2. 수집된 원문을 DB에 저장한다.
3. LLM으로 한국어 번역, 요약, 태그, 게시물 유형을 생성한다.
4. 어드민 페이지에서 관리자가 원문과 번역문을 확인한다.
5. 관리자가 Accept하면 LLM이 웹 게시물과 카드뉴스 초안을 생성한다.
6. 관련 선수/구단 이미지를 자동 후보 추천한다.
7. 이미지의 라이선스, 작가, 출처 정보를 저장한다.
8. 관리자가 사용할 이미지를 선택한다.
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
[LLM 번역/요약]
        ↓
[Admin Inbox 표시]
        ↓
[관리자 Accept]
        ↓
[LLM 콘텐츠 초안 생성]
        ↓
[엔티티 기반 이미지 후보 검색]
        ↓
[라이선스/출처 저장]
        ↓
[관리자 이미지 선택]
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
어드민에서 수동으로 X 링크/원문 입력 → 번역/요약 → Accept → 카드뉴스 생성

2순위:
X Filtered Stream 자동 수집

3순위:
Wikimedia Commons 이미지 후보 자동 추천

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
자동 번역: 허용
자동 요약: 허용
자동 초안 생성: 허용
자동 이미지 후보 추천: 허용
자동 외부 게시: 금지
```

---

## 4-2. 이미지 사용 정책

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

## 4-3. Wikimedia Commons 라이선스 필터 정책

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
  | 'SAFE_NO_RESTRICTIONS'
  | 'SAFE_WITH_ATTRIBUTION'
  | 'REVIEW_SAME_LICENSE'
  | 'BLOCKED_OTHER'
  | 'UNKNOWN';
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
  TRANSLATING
  TRANSLATED
  ACCEPTED
  REJECTED
  IGNORED
  ERROR
}
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

## 7-1. 어드민 Inbox

```text
GET /api/admin/raw-posts
GET /api/admin/raw-posts/:id
POST /api/admin/raw-posts/:id/accept
POST /api/admin/raw-posts/:id/reject
POST /api/admin/raw-posts/:id/translate
```

---

## 7-2. 초안 생성

```text
POST /api/admin/article-drafts/:id/regenerate
PATCH /api/admin/article-drafts/:id
POST /api/admin/article-drafts/:id/approve
POST /api/admin/article-drafts/:id/publish
```

---

## 7-3. 카드뉴스

```text
GET /api/admin/card-news/:id
PATCH /api/admin/card-news/:id
POST /api/admin/card-news/:id/regenerate
POST /api/admin/card-news/:id/render
POST /api/admin/card-news/:id/approve
```

---

## 7-4. 이미지 후보

```text
GET /api/admin/image-assets/search?query=son%20heung%20min
POST /api/admin/image-assets/import
POST /api/admin/image-assets/upload
PATCH /api/admin/image-assets/:id/approve
PATCH /api/admin/card-slides/:id/select-image
```

---

## 8. LLM 작업 설계

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
  suggestedPostType: 'GENERAL' | 'POLL' | 'TODAY_DEBATE';
  suggestedRumorStatus:
    | 'Monitoring'
    | 'Interest'
    | 'Contact'
    | 'Talks'
    | 'Advanced'
    | 'Here We Go'
    | 'Official'
    | 'Denied'
    | 'Collapsed'
    | 'Unknown';
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
  postType: 'GENERAL' | 'POLL' | 'TODAY_DEBATE';
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
      | 'TITLE_IMAGE'
      | 'SUMMARY'
      | 'AGREE_DISAGREE'
      | 'SOURCE_STATUS'
      | 'CTA_COMMENT'
      | 'CTA_POLL'
      | 'CTA_DEBATE';
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
수집된 X 게시물과 번역 결과를 빠르게 확인한다.

표시 항목:

```text
- 출처 계정
- 원문 게시 시간
- 원문 텍스트
- 번역문
- 1줄 요약
- 관련 선수/구단
- 추천 게시물 유형
- 추천 루머 상태
- 위험 플래그
- 원문 링크
- Accept / Reject / Hold 버튼
```

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
translate-raw-post
create-article-draft
create-card-news-draft
search-image-candidates
render-card-news-images
send-admin-notification
```

---

## 13. 상태 전이

## 13-1. RawPost 상태

```text
NEW
→ TRANSLATING
→ TRANSLATED
→ ACCEPTED / REJECTED / IGNORED
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

새 게시물이 들어오면 Slack으로 관리자에게 알림을 보낸다.

알림 예시:

```text
[새 PL 루머 감지]

출처: @FabrizioRomano
요약: 맨유가 새로운 미드필더 후보를 검토 중입니다.
추천 유형: GENERAL
상태: Monitoring

어드민에서 확인하기:
/admin/raw-posts/{id}
```

오늘의 토론 후보로 추천된 경우 별도 강조한다.

```text
[오늘의 토론 후보]

이 이슈는 찬반이 명확해 토론 주제로 적합합니다.
추천 주제: 맨유는 브루노를 매각해야 할까?
```

---

## 15. 구현 순서

## Phase 1. 수동 입력 기반 MVP

```text
1. 어드민 로그인
2. Raw Post 수동 입력 화면
3. LLM 번역/요약
4. 어드민 Inbox
5. Accept / Reject
6. Article Draft 생성
7. Card News Draft 생성
```

목표:
X 자동 수집 없이도 전체 콘텐츠 제작 플로우를 검증한다.

---

## Phase 2. 이미지 후보 추천

```text
1. ImageAsset 모델 추가
2. Wikimedia Commons 검색 연동
3. 라이선스 필터링
4. 이미지 후보 어드민 표시
5. 이미지 선택 기능
6. 출처 문구 자동 삽입
```

---

## Phase 3. 카드뉴스 렌더링

```text
1. React 카드뉴스 템플릿 구현
2. Playwright 렌더링 API 구현
3. Storage 업로드
4. PNG 미리보기
5. 다운로드 기능
```

---

## Phase 4. X Filtered Stream

```text
1. SourceAccount 관리 화면
2. X Filtered Stream 연결
3. 중복 게시물 필터링
4. RawPost 자동 저장
5. Slack 알림
6. 번역 Queue 자동 실행
```

---

## Phase 5. 웹 게시

```text
1. Article 공개 페이지
2. 릴스형 피드 데이터 연결
3. 일반/논쟁형/오늘의 토론 게시물 타입 반영
4. 댓글/투표/토론방 연결
```

---

## 16. Codex 작업 지시용 TODO

아래 순서대로 Codex에게 작업을 요청한다.

```text
1. Prisma schema에 SourceAccount, RawPost, TranslatedPost, ArticleDraft, CardNewsDraft, CardSlide, ImageAsset 모델을 추가해줘.

2. RawPost를 수동으로 생성할 수 있는 어드민 페이지와 API를 만들어줘.

3. RawPost 원문을 OpenAI API로 번역/요약해서 TranslatedPost로 저장하는 서버 액션 또는 API를 만들어줘.

4. Admin Inbox에서 RawPost와 TranslatedPost를 함께 보여주고 Accept/Reject 버튼을 만들어줘.

5. Accept 버튼을 누르면 ArticleDraft와 CardNewsDraft를 생성하는 API를 만들어줘.

6. CardNewsDraft의 슬라이드 데이터를 수정할 수 있는 Card News Editor 페이지를 만들어줘.

7. Wikimedia Commons에서 이미지 후보를 검색하고 ImageAsset으로 저장하는 API를 만들어줘.

8. 이미지 후보의 라이선스 정보를 어드민에서 확인하고 슬라이드에 선택할 수 있게 만들어줘.

9. React 기반 카드뉴스 템플릿 페이지를 만들고, CardSlide 데이터를 받아 1080x1350 카드로 렌더링해줘.

10. Playwright로 카드뉴스 템플릿을 PNG로 캡처하고 Storage에 업로드하는 API를 만들어줘.

11. 렌더링된 카드뉴스 이미지를 어드민에서 미리보기하고 다운로드할 수 있게 만들어줘.

12. SourceAccount를 등록하고 X Filtered Stream으로 게시물을 자동 수집하는 Worker를 만들어줘.
```

---

## 17. 개발 시 주의사항

```text
1. 원문 게시물 ID 기준으로 중복 저장을 막는다.
2. LLM 결과는 항상 JSON Schema로 검증한다.
3. LLM 결과를 바로 게시하지 않는다.
4. 관리자가 수정 가능한 구조를 유지한다.
5. 이미지 출처와 라이선스는 반드시 DB에 저장한다.
6. 카드뉴스에 이미지 출처를 표시한다.
7. 같은 라이선스 요구 이미지의 경우 관리자 검토 상태로 둔다.
8. 공식 구단 로고와 선수 SNS 이미지를 무단 사용하지 않는다.
9. 에러 발생 시 RawPost 또는 Draft 상태를 ERROR로 남긴다.
10. Slack 알림에는 원문 전문보다 요약과 어드민 링크를 중심으로 보낸다.
```

---

## 18. 최종 MVP 정의

MVP 완료 기준은 다음과 같다.

```text
1. 관리자가 X 원문을 수동 입력할 수 있다.
2. 원문이 자동 번역/요약된다.
3. 관리자가 Accept/Reject할 수 있다.
4. Accept 시 웹 게시물 초안과 카드뉴스 초안이 생성된다.
5. 카드뉴스 슬라이드마다 이미지 후보를 선택할 수 있다.
6. 이미지 후보에는 출처와 라이선스가 표시된다.
7. 카드뉴스가 1080x1350 PNG로 렌더링된다.
8. 관리자가 PNG를 다운로드할 수 있다.
9. 이후 X Filtered Stream을 붙일 수 있는 구조로 되어 있다.
```

---

## 19. 한 줄 요약

> X 게시물을 자동 수집하고, LLM으로 번역·초안화하고, 라이선스가 명확한 이미지를 후보로 추천한 뒤, 관리자가 승인한 텍스트와 이미지만 카드뉴스로 렌더링하는 어드민 중심 콘텐츠 자동화 시스템을 만든다.

