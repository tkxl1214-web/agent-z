# Agent Z

Agent Z는 한국어 중심의 AI 대화 앱입니다. 전달받은 주황색 로고와 화면 참고 이미지를 바탕으로 웹, 설치형 PWA, Android, iOS 공통 앱을 준비했습니다.

## AI 동작 방식

- OpenAI API 대신 공개 가중치의 `Qwen3-0.6B-Instruct`를 브라우저 안에서 실행합니다. Agent Z의 말투, 대화 맥락, 사용자가 저장한 기억을 조합하는 앱 로직은 이 프로젝트가 제공합니다.
- 첫 실행 때 Hugging Face에서 기기용 모델 파일 약 650MB를 내려받습니다. 브라우저에 캐시한 뒤 같은 기기에서 사용하며, GPU가 없는 기기는 더 큰 CPU 모델을 받아 속도가 느릴 수 있습니다.
- 대화 내용은 계정이 없을 때 해당 브라우저·기기에 저장됩니다. Firebase와 Google 로그인을 설정하고 로그인하면 대화와 기억을 본인 계정의 Firestore에 저장합니다.
- 저장한 기억은 응답 참고 정보로만 쓰며 기반 모델을 재학습시키거나 가중치를 바꾸지 않습니다.

## 포함 기능

- 모바일과 데스크톱에 대응하는 Agent Z 대화 화면
- 브라우저 기기 내 추론과 대화 맥락·기억을 조합하는 Agent Z 로직
- 로컬 대화·기억 저장 및 Firebase 계정별 동기화
- Firebase Authentication을 통한 웹·네이티브 Google 로그인
- 설치 가능한 PWA, GitHub Pages 배포 workflow
- Capacitor Android 및 iOS 프로젝트

## 로컬 실행

1. Node.js 22 이상과 pnpm을 설치합니다.
2. 프로젝트에서 `pnpm install`을 실행합니다.
3. `pnpm dev`를 실행합니다.

Firebase 설정 전에도 기기 내 AI와 로컬 저장을 쓸 수 있습니다. 웹 Google OAuth 로그인은 전달받은 Client ID로 가능하며, Firebase 설정 전까지 Google 로그인 프로필별 기록은 현재 브라우저에만 저장됩니다. 계정 간 동기화에는 아래 Firebase 설정이 필요합니다.

## Google 로그인과 동기화 설정

1. 웹 Google 로그인은 전달받은 OAuth Client ID로 동작합니다. Google Cloud Console의 승인된 JavaScript 원본에 `https://tkxl1214-web.github.io`와 로컬 개발 주소를 등록합니다. Firebase 계정 동기화를 쓰려면 프로젝트에 Web App과 Cloud Firestore를 추가하고 Authentication에서 Google 로그인을 사용 설정합니다.
2. Firebase Authentication의 승인된 도메인에 `localhost`, `tkxl1214-web.github.io`, 사용할 커스텀 도메인을 추가합니다.
3. `.env.example`을 `.env.local`로 복사하고 Firebase Web App 설정값을 입력합니다.
4. Firebase Console에서 Firestore를 시작한 뒤 이 저장소의 `firestore.rules`를 배포합니다.

       npx firebase-tools login
       npx firebase-tools use --add
       npx firebase-tools deploy --only firestore:rules

Google OAuth Web Client ID로 보내주신 값은 다음과 같습니다.

       162308988172-fgm6ei5uvpodbqtnjcijijfq5e3bj7le.apps.googleusercontent.com

Firebase Authentication의 Google 제공자에 같은 Web Client ID가 등록되어 있는지 확인하세요. 이 ID만으로는 Firebase Web App 설정값(API Key, Auth Domain, Project ID, App ID)이 만들어지지 않습니다. 해당 값은 Firebase Console의 Web App 설정에서 가져와야 합니다.

GitHub Actions에서 Settings → Secrets and variables → Actions → Variables에 다음 값을 추가하면 공개 웹 앱의 Google 로그인이 활성화됩니다.

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_GOOGLE_OAUTH_CLIENT_ID` (기본값은 전달받은 OAuth Client ID)
- `VITE_BASE_PATH` (기본 Pages 주소에서는 `/agent-z/`; 커스텀 도메인 연결 후 `/`)

Firebase 웹 앱 설정과 OAuth Client ID는 클라이언트용 설정입니다. 비밀 키나 서비스 계정 파일은 GitHub에 올리지 마세요. Firebase를 설정하면 Google 계정에 대화와 기억이 동기화됩니다.

## GitHub Pages 배포

저장소의 Actions workflow는 `main`에 변경이 올라오면 Vite 앱을 빌드하고 `dist`를 GitHub Pages에 게시합니다. Repository Settings → Pages → Build and deployment에서 Source가 **GitHub Actions**인지 확인하세요.

기본 주소는 [https://tkxl1214-web.github.io/agent-z/](https://tkxl1214-web.github.io/agent-z/)입니다.

## 커스텀 도메인

GitHub는 도메인을 등록하거나 판매하지 않습니다. 보유 중인 도메인이 있으면 저장소 Settings → Pages에 입력하고 도메인 DNS 관리 화면에서 GitHub가 안내하는 레코드를 추가하세요. `VITE_BASE_PATH`를 `/`로 바꾸고 재배포한 뒤 Firebase Authentication 승인 도메인에도 해당 호스트를 추가합니다. 실제 도메인은 아직 전달되지 않아 기본 Pages 주소를 사용합니다.

## 웹·모바일 앱

- **PWA:** 지원 브라우저에서 앱 설치 또는 홈 화면에 추가를 선택합니다. iPhone/iPad에서는 Safari 공유 메뉴 → 홈 화면에 추가를 선택합니다.
- **Android/iOS:** Firebase에 앱을 각각 등록한 뒤 `google-services.json`을 `android/app/`, `GoogleService-Info.plist`를 `ios/App/App/`에 추가합니다. Android SHA-1 인증서 지문과 iOS Google 로그인 URL scheme도 설정한 뒤 `pnpm cap:sync`를 실행합니다.
- Android 앱은 Android Studio에서 빌드·서명합니다. iOS 앱은 macOS의 Xcode에서 빌드·서명합니다. Google Play와 App Store 공개에는 개발자 계정, 서명, 개인정보 자료와 스토어 심사가 필요합니다.

앱 식별자는 `capacitor.config.ts`의 `com.agentz.ai`입니다. 스토어 빌드 전 최종 식별자로 바꾸세요.

## 데이터와 개인정보

AI 모델은 사용자가 입력한 대화문을 기기 안에서 처리합니다. 모델 파일을 처음 받을 때 Hugging Face에서 모델 데이터가 전송됩니다. Google 계정으로 로그인한 경우 대화와 기억이 해당 사용자의 Firebase UID 아래 저장됩니다. 각 대화와 기억은 앱에서 삭제할 수 있습니다. 운영자 연락처와 전체 계정 삭제 절차는 공개 운영 전에 추가해야 합니다.

전달받은 로고를 PWA 및 Android/iOS 아이콘에 반영했습니다. 화면 참고 이미지와 ZIP 원본은 공개 저장소에서 제외합니다.
