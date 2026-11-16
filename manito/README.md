# 마니또 팝

이름을 모아 한 번 추첨하고, 참가자가 자기 마니또만 확인하는 모바일 웹서비스입니다. 배포는 실행하지 않았습니다.

## 실행

Node.js 22.13 이상이 필요합니다. 테스트의 TypeScript 직접 실행은 Node.js 22.18 이상을 사용하세요. 검증 환경은 Node.js 26입니다.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_thin_sleeper.sql
npm run dev
```

마이그레이션 SQL은 새 로컬 데이터베이스에 최초 한 번만 실행합니다. 이후에는 `npm run dev`로 실행합니다. 기본 주소는 http://127.0.0.1:5173 입니다. 로컬 데이터는 `.wrangler/state`에 저장되므로 이 폴더를 지우면 로컬 모임도 지워집니다.

## 사용 흐름

1. 모임 이름과 참가자 이름을 입력합니다. 관리자도 명단에 포함합니다. 같은 이름은 별명 등으로 구분해야 합니다.
2. 생성 후 관리자 화면에서 **두근두근, 마니또 섞기**를 누릅니다.
3. **참가자 초대 링크**를 공유합니다. 관리자 링크에는 재추첨 권한이 있으므로 공유하지 않습니다.
4. 참가자는 본인 이름과 처음 설정할 숫자 6자리 확인번호를 입력합니다. 다음에는 **다시 확인해요**에서 같은 번호를 입력합니다.
5. 관리자는 **나도 마니또 확인하기**로 참여합니다. 관리 화면과 API에는 전체 배정 결과가 노출되지 않습니다.
6. **마니또 다시 섞기**는 관리자만 실행할 수 있습니다. 기존 결과를 무효화하고 회차를 올립니다. 확인한 참가자들에게 새 결과를 확인하라고 별도로 알려주세요.

2명일 때는 서로가 마니또이므로 재추첨해도 결과가 같습니다. 3명 이상도 무작위 추첨이므로 이전과 같은 결과가 나올 수 있습니다. 브라우저를 다시 열거나 결과를 재조회하는 동작 자체는 재추첨을 하지 않습니다.

## 저장과 개인정보 보호

- React 19 + Vinext/Vite, Cloudflare Worker API, D1 데이터베이스를 사용합니다. 정적 파일만 배포하면 동작하지 않습니다.
- 배정은 서버에서 암호학적 난수로 섞고 자기 자신이 없는 순열만 채택합니다. 대상이 겹치지 않으며 모든 유효한 순열의 확률이 같습니다.
- 결과는 서버 D1에 저장합니다. 공개 모임 조회는 제목·참가자 수·회차만 반환합니다. 참가자 이름 목록은 관리자만 받습니다.
- 관리자 권한은 무작위 256비트 토큰으로 확인하고 DB에는 토큰 해시를 저장합니다. 링크의 URL fragment에 원본 토큰이 있으며, 같은 기기에서 다시 열 수 있도록 최근 관리자 링크를 localStorage에 보관합니다. 공용 기기에서는 이 점을 유의하세요.
- 개인 확인번호는 참가자별 무작위 salt와 PBKDF2-SHA256 100,000회로 처리합니다. 5회 오류 시 해당 참가자를 10분 동안 잠급니다.
- 최초 등록은 **이름을 선점하는 신뢰 기반 방식**입니다. 실명 인증을 하지 않으므로 다른 사람이 먼저 그 이름으로 등록하는 것을 막지는 못합니다. 엄격한 본인 확인이 필요하면 개인별 초대 코드 또는 계정 인증을 추가해야 합니다.
- 확인번호 복구/초기화 기능은 없습니다. 재추첨해도 확인번호는 유지됩니다.
- 서버 운영자/DB 소유자는 저장 데이터에 접근할 수 있습니다. 앱의 모임 관리자에게 전체 배정을 보여주지 않는다는 의미이며 종단 간 암호화는 아닙니다.
- 다른 탭으로 이동하면 화면의 결과를 숨깁니다. 열려 있는 페이지는 15초마다 최신 회차를 확인하고 포커스를 되찾을 때도 갱신합니다.
- 동시 변경은 DB revision 조건부 갱신으로 충돌을 감지합니다. 동시 재추첨은 한 요청만 성공합니다.

## 직접 Cloudflare에 배포하기

아래 명령은 사용자가 직접 실행할 배포 절차입니다. 이 작업에서 실행하지 않았습니다.

```sh
npx wrangler login
npx wrangler d1 create manito-pop
cp wrangler.deploy.example.jsonc wrangler.deploy.jsonc
```

생성 결과의 실제 `database_id`를 `wrangler.deploy.jsonc`에 입력합니다. 다른 DB 이름을 만들었다면 `database_name`도 맞춥니다. 개발/빌드용 임시 DB ID가 들어 있는 `dist/server/wrangler.json`을 직접 배포에 사용하지 마세요.

```sh
npm run build
npx wrangler d1 migrations apply DB --remote --config wrangler.deploy.jsonc
npx wrangler deploy --config wrangler.deploy.jsonc
```

배포 후 출력되는 HTTPS 주소로 모임을 만들어야 다른 기기에서도 접속할 수 있습니다. 로컬 모임과 배포된 모임의 데이터베이스는 서로 다릅니다. Google Fonts를 불러오지 못하면 기기의 기본 글꼴을 사용합니다.

`.openai/hosting.json`은 초기 Sites 준비 과정의 연결 정보를 포함합니다. 사이트 등록만 되었으며 버전 저장·소스 업로드·배포·공개 접근 변경은 하지 않았습니다. 자체 Cloudflare 배포는 위 별도 설정을 사용합니다.

## 검증

```sh
npm run typecheck
npm test
npm run build
# 로컬 서버 실행 중 별도 터미널에서:
npm run test:api
```

추첨 속성 테스트는 2~100명에 대해 각 100회, 총 9,900회 확인합니다. API 통합 테스트는 검증용 모임을 로컬 DB에 생성하고 중복 이름, 최소 인원, 추첨 전 조회, 권한, 결과 유지, 동시 조회, 확인번호 잠금, 동시 재추첨, 회차 변경, 외부 Origin 차단을 검증합니다. 실제 운영 서버를 대상으로 실행하지 마세요.

핵심 파일: `app/page.tsx`, `app/globals.css`, `app/api/rooms/route.ts`, `lib/draw.ts`, `db/schema.ts`.
