# AI 피드백 시제품

Spring Boot에서 확정한 평가와 실제 조사 기록으로 한국어 교육 피드백을 생성한다. Java 21 호출 모듈을 샘플과 백엔드가 함께 사용한다.

| WBS | 산출물 |
| --- | --- |
| 5.1.1 · 5.1.2 | [공통 교육 원칙과 4개 유형별 판단 기준](education.md) |
| 5.1.3 | 아래 인증·요금·응답 처리 명세 |
| 5.1.4 | [입력 스키마](src/main/resources/input.schema.json), [출력 스키마](src/main/resources/feedback.schema.json) |
| 5.2.1 | [교육 피드백 프롬프트 초안](src/main/resources/feedback-prompt.txt) |
| 5.2.2 | [호출 모듈](src/main/java/com/scamguard/ai/FeedbackClient.java), [채용 샘플](examples/job.json), [호출·형식 검증](src/test/java/com/scamguard/ai/FeedbackClientTest.java) |
| 5.2.3 | [4개 유형별 정상·사기·위험 대응 평가 12건](../backend/src/test/resources/feedback/cases.json) |
| 4.3.3 · 5.3.2 · 5.3.3 | [Spring Boot 연동과 장애 처리 검증](#spring-boot-연동) |

## 실행

JDK 21을 설치한 환경에서 `ai` 디렉터리로 이동한다. 첫 빌드에는 Gradle과 라이브러리를 받기 위한 네트워크 연결이 필요하다.

```powershell
.\gradlew.bat clean test
```

실제 호출 시 서버 환경 변수 `ANTHROPIC_API_KEY`에 해당 워크스페이스의 Claude API 키를 설정한다. 기본 모델은 백엔드 설정과 같은 `claude-sonnet-5`이며 `ANTHROPIC_MODEL`로 변경할 수 있다. 아래 명령은 합성한 채용 사례 한 건을 전송하고 검증된 피드백을 출력한다. macOS·Linux에서는 `./gradlew`를 사용한다.

```powershell
.\gradlew.bat run --args="examples/job.json"
```

## 요청과 비용

공식 Java SDK가 `POST https://api.anthropic.com/v1/messages`에 `x-api-key`, `anthropic-version: 2023-06-01`, JSON 콘텐츠 유형을 포함해 전송한다. 교육 규칙은 `system`, 평가 입력은 사용자 메시지 1건으로 분리한다. 출력 한도는 1,200토큰, 제한 시간은 20초이며 자동 재시도는 0회다. [Messages API](https://platform.claude.com/docs/en/api/messages/create)

11월 23일 확인한 Sonnet 5 표준 단가는 입력 100만 토큰당 2달러, 출력 100만 토큰당 10달러다. 캐시를 사용하지 않고 입력 2,000토큰과 출력 400토큰을 사용한 경우 예상 비용은 0.008달러다. 실제 사용량은 응답의 `usage.input_tokens`와 `usage.output_tokens`로 확인한다. [Anthropic 요금표](https://platform.claude.com/docs/en/about-claude/pricing)

## 백엔드 입력 협의안

| 입력 | 생성 기준 |
| --- | --- |
| scenarioId, correctJudgment | 현재 세션에 연결된 시나리오 ID와 사례의 case_type. 유형은 JOB, SIDE, INV, TRAVEL이다. |
| userJudgment, responseAction, reason | 최종 제출의 판단, 선택한 대응, 자유 입력 근거. 백엔드는 Claude에 보내기 전에 자유 입력에서 이메일과 연속 숫자로 된 식별 정보 패턴을 가린다. |
| decisionCorrect, score | play_evaluation에서 확정한 정오와 점수. 시제품은 입력된 정오가 두 판단과 일치하는지 검사한다. |
| completedChecks, missedChecks | 백엔드가 나눈 조사 항목 목록. 각 항목은 eventName, targetId, score를 포함한다. |
| riskActions | 백엔드가 위험 행동으로 분류한 이벤트와 대상 목록. 현재 backend의 DecisionService는 빈 배열을 저장하므로 미수집 상태에서도 빈 배열을 전송한다. |
| actions | 해당 세션의 action_event를 sequenceNo 순으로 구성한다. 화면 열람과 실제 송금·제출을 구분한다. |
| verifiedFacts | 이번 사례에서 실제 확인한 자료의 사실만 sourceId, eventName, fact로 전달한다. 확인 사실이 없으면 빈 배열이다. |

`verifiedFacts`는 서버에서 작성한다. 같은 세션의 실제 이벤트와 현재 사례의 `content.evidence`를 대조한다. 메시지는 MESSAGE_VIEWED, 문의는 PHONE_INQUIRY_SELECTED, 질문은 QUESTION_SELECTED, 컴퓨터 페이지는 해당 페이지 유형의 열람 이벤트와 연결한다. 대상 ID까지 일치하고 실제 공개된 내용이 해당 사실을 뒷받침할 때만 포함한다. 발신자의 요구는 “발신자가 요구했다”로 기록한다. 사용자 메모나 자유 입력을 사실 목록으로 승격하지 않는다. 시제품은 전달받은 각 사실과 행동의 이벤트명·대상 ID 쌍을 다시 검사한다.

예제의 JOB_MSG_003과 JOB_PAGE_004는 각각 외부 접수 요구와 공식 제출 경로를 뒷받침한다. 누락 항목인 JOB_CALL_004의 답변은 입력에 넣지 않는다. 백엔드는 실제 행동의 이벤트와 대상 ID에 맞는 사례 사실을 추출한다. 해당 입력 계약은 백엔드 담당자 검토 대상이다.

## 응답 처리

API 봉투의 `stop_reason`이 `end_turn`일 때 텍스트 블록 한 개를 읽는다. 본문은 아래 네 필드만 허용한다. 문자열은 공백만으로 구성할 수 없고 배열은 한 항목 이상이어야 한다. 형식 위반, 중복 키, 잘림, 후행 JSON, 호출 오류는 호출자에게 실패로 반환한다. 백엔드는 호출 실패 시 기본 해설을 저장하고 반환한다.

```json
{
  "summary": "공식 안내와 메시지를 대조해 사기 여부를 올바르게 판단했습니다.",
  "strengths": ["서류 접수 경로가 공식 홈페이지 안내와 다르다는 점을 확인했습니다."],
  "improvements": ["공식 인사팀에도 접수 경로를 문의해 보세요."],
  "recommendation": "서류를 보내기 전에 회사 홈페이지에서 찾은 인사팀 연락처로 접수 방법을 확인하세요."
}
```

위 내용은 기대 형식을 보여 주는 작성 예시다. sessionId, feedbackId, feedbackSource, preventionTips는 백엔드가 결과 화면에 덧붙이는 값이다. 교육 문항에 대한 실제 모델 응답의 정확성과 4개 유형 간 일관성은 후속 평가에서 확인한다.

## Spring Boot 연동

`POST /api/sessions/{sessionId}/feedback`은 완료된 세션의 판정·점수·근거·행동을 DB에서 읽는다. 모델 피드백은 `AI`, 비활성 상태나 실패 시 반환하는 기본 해설은 `FALLBACK`으로 저장한다. 같은 세션을 다시 요청하면 저장한 피드백을 반환한다. 기본 해설은 채점 결과, 완료·미완료 조사 항목, 위험한 최종 대응과 유형별 다음 행동을 반영한다.

| 환경 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `SCAMGUARD_AI_ENABLED` | `false` | Claude 호출 활성화 |
| `ANTHROPIC_API_KEY` | 비어 있음 | 서버 인증 키 |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | 메시지 모델 |
| `SCAMGUARD_AI_TIMEOUT` | `20s` | 응답 제한 시간 |

### 통합 테스트

별도 PostgreSQL 테스트 DB에 `database/schema.sql`과 `database/constraints.sql`을 적용한다. 기존 테스트도 같은 DB 설정을 사용한다.

```powershell
Set-Location backend
$env:SPRING_DATASOURCE_URL = 'jdbc:postgresql://localhost:5432/scamguard_test'
$env:DB_PASSWORD = '<테스트 DB 비밀번호>'
$env:SCAMGUARD_FEEDBACK_DB_TEST = 'true'
.\gradlew.bat clean build :ai:test
```

채용·재택부업은 저장소 사례 데이터를 사용한다. 투자 리딩방·숙소 예약은 실제 게임 데이터가 준비되면 교체할 테스트 사례다. 각 문항의 기대 피드백은 실모델 검토 기준이다. 통합 테스트는 12개 문항의 평가, 실제 기록에 연결된 사실, 저장 및 재요청과 함께 인증 실패, 요청 한도, 서비스 오류, 응답 형식 오류, 타임아웃의 기본 해설 반환을 확인한다. 모의 서버가 응답하므로 API 키 없이 실행할 수 있다.

2026-11-23 검증에서 Spring Boot 테스트 19건과 Claude 호출 모듈 테스트 13건이 통과했다. 실제 Claude 호출과 응답의 교육 품질 검토는 최종 검증 단계에 진행한다.
