# AI 피드백 시제품

Spring Boot가 확정한 평가 결과를 Java 21 호출 모듈에 전달해 한국어 교육 피드백을 받는다. 개발 일정상 11월 23일 범위는 호출·검증 시제품까지다. DB 조립과 저장은 이후 백엔드 연동 단계에서 처리한다.

| WBS | 산출물 |
| --- | --- |
| 5.1.1 · 5.1.2 | [공통 교육 원칙과 4개 유형별 판단 기준](education.md) |
| 5.1.3 | 아래 인증·요금·응답 처리 명세 |
| 5.1.4 | [입력 스키마](src/main/resources/input.schema.json), [출력 스키마](src/main/resources/feedback.schema.json) |
| 5.2.1 | [교육 피드백 프롬프트 초안](src/main/resources/feedback-prompt.txt) |
| 5.2.2 | [호출 모듈](src/main/java/com/scamguard/ai/FeedbackClient.java), [채용 샘플](examples/job.json), [호출·형식 검증](src/test/java/com/scamguard/ai/FeedbackClientTest.java) |

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
| userJudgment, responseAction, reason | 최종 제출의 판단, 선택한 대응, 자유 입력 근거. 자유 입력에 개인 식별 정보가 있으면 백엔드에서 제거하고 전송한다. |
| decisionCorrect, score | play_evaluation에서 확정한 정오와 점수. 시제품은 입력된 정오가 두 판단과 일치하는지 검사한다. |
| completedChecks, missedChecks | 백엔드가 나눈 조사 항목 목록. 각 항목은 eventName, targetId, score를 포함한다. |
| riskActions | 백엔드가 위험 행동으로 분류한 이벤트와 대상 목록. 현재 backend의 DecisionService는 빈 배열을 저장하므로 미수집 상태에서도 빈 배열을 전송한다. |
| actions | 해당 세션의 action_event를 sequenceNo 순으로 구성한다. 화면 열람과 실제 송금·제출을 구분한다. |
| verifiedFacts | 이번 사례에서 실제 확인한 자료의 사실만 sourceId, eventName, fact로 전달한다. 확인 사실이 없으면 빈 배열이다. |

`verifiedFacts`는 서버에서 작성한다. 같은 세션의 실제 이벤트와 현재 사례의 `content.evidence`를 대조한다. 메시지는 MESSAGE_VIEWED, 문의는 PHONE_INQUIRY_SELECTED, 질문은 QUESTION_SELECTED, 컴퓨터 페이지는 해당 페이지 유형의 열람 이벤트와 연결한다. 대상 ID까지 일치하고 실제 공개된 내용이 해당 사실을 뒷받침할 때만 포함한다. 발신자의 요구는 “발신자가 요구했다”로 기록한다. 사용자 메모나 자유 입력을 사실 목록으로 승격하지 않는다. 시제품은 전달받은 각 사실과 행동의 이벤트명·대상 ID 쌍을 다시 검사한다.

예제의 JOB_MSG_003과 JOB_PAGE_004는 각각 외부 접수 요구와 공식 제출 경로를 뒷받침한다. 누락 항목인 JOB_CALL_004의 답변은 입력에 넣지 않는다. 기존 backend 입력에 scenarioId와 verifiedFacts를 추가하는 협의안이며 DB에서 사실을 선별하는 작업은 5.3.2에서 연결한다.

## 응답 처리

API 봉투의 `stop_reason`이 `end_turn`일 때 텍스트 블록 한 개를 읽는다. 본문은 아래 네 필드만 허용한다. 문자열은 공백만으로 구성할 수 없고 배열은 한 항목 이상이어야 한다. 형식 위반, 중복 키, 잘림, 후행 JSON, 호출 오류는 호출자에게 실패로 반환한다. 서비스 계층은 이 실패를 받아 기본 해설을 선택할 수 있다.

```json
{
  "summary": "공식 안내와 메시지를 대조해 사기 여부를 올바르게 판단했습니다.",
  "strengths": ["서류 접수 경로가 공식 홈페이지 안내와 다르다는 점을 확인했습니다."],
  "improvements": ["공식 인사팀에도 접수 경로를 문의해 보세요."],
  "recommendation": "서류를 보내기 전에 회사 홈페이지에서 찾은 인사팀 연락처로 접수 방법을 확인하세요."
}
```

위 내용은 기대 형식을 보여 주는 작성 예시다. sessionId, feedbackId, feedbackSource, preventionTips는 백엔드가 결과 화면에 덧붙이는 값이다. 교육 문항에 대한 실제 모델 응답의 정확성과 4개 유형 간 일관성은 후속 평가에서 확인한다.
