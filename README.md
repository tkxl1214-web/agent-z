# Agent Z

Agent Z는 한국어 중심의 AI 대화 앱입니다. 전달받은 주황색 로고와 화면 참고 이미지를 바탕으로 웹·설치형 PWA·Android·iOS용 공통 앱을 준비했습니다.

대화 맥락을 바탕으로 답변을 생성하고, 사용자가 직접 저장한 메모 최대 25개를 참고합니다. 저장 메모는 사용자가 관리하는 참고 정보이며 기반 AI 모델을 재학습하거나 가중치를 바꾸지는 않습니다. 실제 AI 대화에는 Firebase 백엔드와 OpenAI API 키 설정이 필요합니다.

## 포함 기능

- 모바일과 데스크톱에 대응하는 Agent Z 대화 화면
- Firebase Authentication을 통한 Google 로그인 (웹 및 Capacitor 네이티브)
- Firebase Cloud Firestore의 사용자별 비공개 대화·메모
- 사용자 인증이 필요한 Firebase callable 함수와 서버 측 OpenAI Responses API 연결
- 기본 사용 한도: 사용자 계정당 하루 40회, 분당 8회
- 설치 가능한 PWA, GitHub Pages 배포 workflow
- Capacitor Android 및 iOS 프로젝트

## 로컬 실행

1. Node.js 22 이상과 pnpm을 설치합니다.
2. 프로젝트에서 `pnpm install`을 실행합니다.
3. `.env.example`을 `.env.local`로 복사하고 Firebase Console의 웹 앱 설정값을 입력합니다.
4. `pnpm dev`를 실행합니다.

Firebase 설정이 없으면 화면 미리보기만 가능하며 로그인, 메모 저장, AI 대화는 사용할 수 없습니다.

## Firebase와 Google 로그인 설정

1. Firebase 프로젝트를 만들고 Web App과 Cloud Firestore를 추가합니다.
2. Firebase Authentication에서 Google 로그인 공급자를 사용 설정합니다.
3. Authentication의 승인된 도메인에 `localhost`, `tkxl1214-web.github.io`, 사용할 커스텀 도메인을 추가합니다.
4. Firebase 웹 앱 설정값을 `.env.local`에 입력합니다.
5. 프로젝트 루트에서 Firebase CLI에 로그인하고 배포 대상을 선택합니다.

       npx firebase-tools login
       npx firebase-tools use --add

프로젝트 선택 과정은 로컬 `.firebaserc`를 만듭니다. 서비스 계정 파일과 API 비밀 키는 GitHub에 올리지 마세요.

## AI 백엔드 설정

1. 프로젝트 루트에서 의존성을 설치하고 Cloud Functions를 빌드합니다.

       pnpm install
       pnpm --filter agent-z-functions build

2. Firebase Secret Manager에 OpenAI API 키를 대화형으로 등록합니다. 프런트엔드 환경 변수나 GitHub 파일에 키를 넣지 마세요.

       npx firebase-tools functions:secrets:set OPENAI_API_KEY

3. callable 함수와 Firestore 규칙을 배포합니다.

       npx firebase-tools deploy --only functions,firestore:rules

기본 모델은 `gpt-6.1-sol`입니다. 다른 API 모델을 사용하려면 `functions/src/index.ts`의 `AGENTZ_MODEL` 값을 바꾸세요. Firebase 및 OpenAI API 사용료가 발생할 수 있습니다. 공개 사용 전에 과금 한도와 계정별 사용 제한을 검토하세요.

## GitHub Pages 배포

저장소의 Actions workflow는 Vite 앱을 빌드하고 `dist`를 GitHub Pages에 게시합니다. 저장소 Settings → Pages → Build and deployment에서 Source를 **GitHub Actions**로 지정하세요.

Settings → Secrets and variables → Actions → Variables에 다음 값을 추가합니다.

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_BASE_PATH` (기본 Pages URL에서는 `/agent-z/`; 커스텀 도메인 연결 후 `/`)

Firebase 웹 앱 설정은 클라이언트 SDK용 식별자입니다. 사용자 데이터 접근은 Firebase 인증과 Firestore 규칙으로 제한합니다. `OPENAI_API_KEY`는 Firebase Secret Manager에만 보관하세요.

GitHub Actions 배포를 설정하고 성공하면 기본 주소는 `https://tkxl1214-web.github.io/agent-z/`입니다.

## 커스텀 도메인

GitHub는 도메인을 등록하거나 판매하지 않습니다. 먼저 도메인을 보유하고 DNS 설정에 접근할 수 있어야 합니다. 저장소 Settings → Pages에서 도메인을 저장한 다음, 도메인 DNS 관리 화면에 GitHub가 안내하는 레코드를 추가하세요. `VITE_BASE_PATH`를 `/`로 바꾸고 재배포한 뒤 Firebase Authentication의 승인된 도메인에도 해당 호스트를 추가합니다.

실제 도메인이 아직 지정되지 않아 기본 Pages 주소로 준비했습니다. 도메인을 알려주면 해당 호스트 유형에 맞는 DNS 레코드를 안내할 수 있습니다. DNS 확인과 HTTPS 인증서 발급에 시간이 걸릴 수 있습니다.

## 웹 설치 및 모바일 앱 패키징

- **PWA:** 지원 브라우저에서 Agent Z를 열고 앱 설치 또는 홈 화면에 추가를 선택합니다. iPhone/iPad에서는 Safari 공유 메뉴 → 홈 화면에 추가를 선택합니다.
- **Android/iOS:** 프로젝트에 이미 네이티브 셸이 포함되어 있습니다. Firebase 설정 후 `pnpm cap:sync`로 웹 자산과 플러그인을 동기화합니다. Firebase Android 앱 파일 `google-services.json`은 `android/app/`, iOS 파일 `GoogleService-Info.plist`는 `ios/App/App/`에 직접 추가합니다. 해당 앱 ID를 Firebase에 등록하고 Android/iOS OAuth 클라이언트와 Android 서명 인증서 지문을 설정해야 합니다.
- Android Studio에서 Android 앱을 빌드·서명합니다. iOS 앱은 macOS의 Xcode에서 빌드·서명합니다. Google Play 및 App Store 등록에는 각 개발자 계정, 서명 정보, 스토어 정보, 개인정보 자료와 심사 절차가 필요합니다.

앱 식별자는 `capacitor.config.ts`의 `com.agentz.ai`입니다. 스토어 빌드 전에 최종 식별자로 바꾸세요.

## 데이터와 개인정보

대화와 메모 문서는 로그인한 Firebase 사용자 UID에 한정됩니다. 대화와 메모는 앱에서 각각 삭제할 수 있습니다. 함수는 답변 생성에 최근 대화 12개와 저장 메모 최대 25개를 사용합니다. 개인정보 안내 초안은 `public/privacy.html`에 있습니다. 스토어 공개 전에 운영자 연락처와 완전한 계정 삭제 절차를 추가하세요.

전달받은 로고를 PWA 및 Android/iOS 아이콘에 반영했습니다. 화면 참고 이미지와 ZIP 원본은 공개 저장소에서 제외합니다.
