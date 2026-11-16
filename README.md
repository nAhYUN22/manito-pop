# 마니또 팝

이름을 모아 한 번 추첨하고, 참가자가 자기 마니또만 확인하는 모바일 웹서비스입니다. **Node.js 24 + Next.js + SQLite**로 실행하며 Cloudflare 계정이나 D1이 필요하지 않습니다.

## 로컬 실행

모든 명령은 저장소 루트 `manito-pop/`에서 실행합니다. Node.js 24 이상을 사용하세요.

```sh
npm ci
npm run dev
```

주소는 http://localhost:3000 입니다. SQLite 파일과 테이블은 첫 API 요청 때 자동 생성됩니다. 기본 경로는 `./data/manito.sqlite`이며 수동 마이그레이션 명령은 필요하지 않습니다. 경로를 바꾸려면 `.env.example`을 `.env.local`로 복사하고 `DATABASE_PATH`를 설정하세요.

운영 빌드:

```sh
npm run build
npm start
```

`npm start`와 Docker 모두 standalone 운영 서버를 실행합니다. 로컬 실행은 저장소의 `.env.local` 등을 읽고 개발 서버와 같은 `./data/manito.sqlite`를 사용합니다. 컨테이너에서는 Dockerfile의 기본 실행 명령을 덮어쓰지 마세요.

## Coolify 설정 — Dockerfile 방식

이 저장소는 이미 루트에 Dockerfile이 있습니다. **아래 설정 후 배포는 직접 실행하세요.**

| 항목 | 값 |
| --- | --- |
| Repository URL | `https://github.com/nAhYUN22/manito-pop` |
| Branch | `main` |
| Build Pack | `Dockerfile` |
| Base Directory | `/` |
| Dockerfile Location | `/Dockerfile` (저장소 루트) |
| Port / Ports Exposes | `3000` |
| Is it a static site? | 체크 해제 |
| Install / Build / Start 명령 덮어쓰기 | 비워두기 — Dockerfile에서 처리 |
| Domains | 사용할 HTTPS 주소 |
| Replicas | `1` |

Dockerfile에 다음 실행 환경변수가 기본으로 들어 있습니다. Coolify에서 덮어쓰지 않는 한 따로 입력할 필요는 없습니다.

```dotenv
NODE_ENV=production
HOSTNAME=0.0.0.0
PORT=3000
DATABASE_PATH=/data/manito.sqlite
```

도메인을 정한 뒤 Coolify의 **런타임 환경변수**로 아래 값을 추가하는 것을 권장합니다. 예시를 그대로 넣지 말고 실제 주소를 사용하세요. `NEXT_PUBLIC_` 접두어나 빌드 시점 설정은 필요하지 않습니다.

```dotenv
APP_ORIGIN=https://실제-마니또-도메인
```

`APP_ORIGIN`은 허용할 브라우저 요청 출처입니다. 경로 없이 주소만 넣습니다. 비워두면 요청의 Host와 `X-Forwarded-Proto`를 사용하므로 Coolify의 HTTPS 프록시 뒤에서도 동작합니다. 값을 지정하면 해당 주소로 들어온 브라우저 요청만 허용합니다. 도메인을 변경할 때 이 값도 수정하세요.

### 영구 볼륨 — 첫 배포 전에 추가

Coolify → **Configuration → Persistent Storage → Add → Volume Mount**:

| 항목 | 값 |
| --- | --- |
| Name | `manito-data` |
| Destination Path | `/data` |
| Source Path | 비워두기 (호스트 경로를 지정하는 Bind Mount가 아님) |

`/data` **디렉터리 전체**를 마운트해야 합니다. SQLite 본체뿐 아니라 WAL/SHM 파일도 같은 볼륨에 있어야 하므로 `/data/manito.sqlite` 파일 하나만 마운트하지 마세요. Dockerfile의 `VOLUME` 선언만 믿지 말고 Coolify에서 위 이름 있는 볼륨을 반드시 연결하세요. 재배포할 때 같은 볼륨 이름을 유지합니다.

앱은 root가 아닌 UID/GID `1001:1001`로 실행됩니다. 새 Docker named volume은 이미지에 설정된 권한을 사용합니다. 직접 만든 bind mount나 기존 볼륨을 사용할 경우 이 사용자에게 쓰기 권한이 있어야 합니다. SQLite는 같은 서버의 로컬 디스크에 두고, 여러 서버/복제본으로 확장하려면 PostgreSQL 등으로 전환하세요.

### 상태 확인

Dockerfile에 HTTP 상태 검사가 포함되어 있습니다. Coolify에서 별도 Health Check를 설정한다면:

- Method: `GET`
- Path: `/api/health`
- Port: `3000`
- Expected status: `200`

DB 파일에 접근할 수 없으면 `503`을 반환합니다. 처음 배포할 때 빈 볼륨의 DB 테이블도 자동으로 만듭니다.

## Docker Compose로 직접 실행

Dockerfile 방식의 Coolify 배포에서는 위 UI에서 볼륨을 추가합니다. 별도의 Compose 방식이나 로컬 Docker에서 실행할 때는 저장소의 `compose.yaml`이 볼륨을 설정합니다.

```sh
docker compose up --build -d
```

http://localhost:3000 에서 열립니다. 기본 named volume은 Compose 프로젝트 이름이 붙은 `manito-data`이며 `/data`에 연결됩니다. 외부 포트는 `APP_PORT`, 공개 주소는 `APP_ORIGIN`으로 지정할 수 있습니다. 데이터가 필요하면 `docker compose down -v`를 실행하지 마세요. `-v`는 볼륨도 삭제합니다.

회사 HTTPS 프록시 때문에 로컬 Docker 빌드에서 `SELF_SIGNED_CERT_IN_CHAIN`이 발생한다면, 해당 조직에서 이미 신뢰하는 CA 번들을 빌드에만 전달할 수 있습니다. 일반적인 Coolify 서버에서는 필요하지 않습니다.

```sh
docker build --secret id=npm_ca,src=/absolute/path/to/trusted-ca.pem -t manito-pop:test .
```

인증서 검증은 유지하며 CA 파일은 운영 이미지에 복사되지 않습니다.

## 백업과 기존 데이터

재배포 시 볼륨 유지와 별도로 백업이 필요합니다. SQLite가 실행 중일 때 본체 파일만 복사하면 최근 WAL 변경이 빠질 수 있으므로 SQLite backup API를 사용하거나 앱을 멈춘 뒤 `/data` 전체를 백업하세요.

이전 개발 버전의 `.wrangler/state` 데이터는 삭제하지 않았지만 새 SQLite 경로에 자동으로 복사하지 않습니다. 이전 모임을 이어서 사용하려면 기존 DB의 `rooms` 데이터를 새 DB로 이전해야 합니다. `rooms`의 열 구성과 저장 형식은 유지했습니다. 새 배포는 별도 볼륨의 새 DB로 시작합니다.

## 사용 흐름

1. 모임 이름과 참가자 이름을 입력합니다. 관리자도 명단에 포함합니다. 같은 이름은 별명으로 구분합니다.
2. 관리자 화면에서 **두근두근, 마니또 섞기**를 누릅니다.
3. **참가자 초대 링크**를 공유합니다. 관리자 링크는 재추첨 권한이 있으므로 공유하지 않습니다.
4. 참가자는 본인 이름과 처음 설정할 숫자 6자리 확인번호를 입력합니다. 이후에는 **다시 확인해요**에서 같은 번호를 입력합니다.
5. 관리자는 **나도 마니또 확인하기**로 참여합니다. 관리 화면/API에는 전체 배정이 노출되지 않습니다.
6. **마니또 다시 섞기**는 관리자만 실행합니다. 회차가 올라가고 기존 결과는 무효가 됩니다. 참가자들에게 다시 확인하라고 알려주세요.

2명일 때는 서로가 마니또라 재추첨해도 같습니다. 3명 이상도 무작위 추첨 결과가 이전과 같을 수 있습니다. 재조회만으로는 결과가 바뀌지 않습니다.

## 저장 및 접근 제어

- 서버에서 암호학적 난수로 순열을 섞고 자기 자신이 없는 경우만 채택합니다. 모든 유효한 배정의 확률은 같습니다.
- SQLite는 WAL 모드와 5초 잠금 대기를 사용합니다. 모임 변경은 revision 조건부 갱신으로 동시 요청을 처리합니다.
- 관리자 토큰은 256비트 난수이며 DB에는 해시만 저장합니다. 관리자 URL의 fragment에 원본 토큰이 있고 최근 모임 재접속을 위해 localStorage에도 보관합니다.
- 확인번호는 참가자별 salt와 PBKDF2-SHA256 100,000회로 처리합니다. 5회 오류 시 10분 잠급니다.
- 최초 등록은 이름을 선점하는 신뢰 기반 방식입니다. 실제 본인 인증은 하지 않습니다. 확인번호 복구 기능은 없고 재추첨해도 번호는 유지됩니다.
- 서버/DB 운영자는 저장된 배정에 접근할 수 있습니다. 앱의 모임 관리자에게 전체 배정을 공개하지 않는 구조이며 종단 간 암호화는 아닙니다.
- 다른 탭으로 이동하면 결과를 숨깁니다. 열려 있는 페이지는 15초마다 또는 포커스를 되찾을 때 최신 회차를 확인합니다.

## 검증

```sh
npm run typecheck
npm test
npm run build
# 로컬 서버 실행 중:
npm run test:api
# Docker 운영 이미지와 실제 영구 볼륨 검증:
docker build -t manito-pop:test .
npm run test:docker
```

단위 테스트는 9,900회 추첨의 중복/자기 배정 여부, SQLite 초기화·재접속·동시 변경·기존 스키마 보존, 프록시 Origin 처리를 확인합니다. API 테스트는 테스트용 모임을 생성하며 운영 주소로 실행하지 마세요. `TEST_BASE_URL`로 로컬 주소를 바꿀 수 있습니다.

컨테이너 테스트는 임시 named volume과 컨테이너를 직접 만들고, 전체 API 흐름과 컨테이너 교체 후 결과·확인번호·관리자 권한 유지를 확인합니다. 자신이 만든 테스트 컨테이너/볼륨만 마지막에 정리합니다.

참고: [Next.js standalone 출력](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Coolify Dockerfile](https://coolify.io/docs/applications/builds/dockerfile), [Coolify Volume Mount](https://coolify.io/docs/core/persistent-storage/storage-mounts/volume-mounts).
