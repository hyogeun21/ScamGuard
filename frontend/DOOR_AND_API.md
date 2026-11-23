# 문 제출·평가

## 현재 동작

문 근처 E → 큰 판단 입력창 → 최종제출 → 확인/취소 → 대기 → 평가 결과.

- 정상/사기 중 하나 선택. 판단근거는 한글/여러 줄/복사·붙여넣기 가능, 10,000자 한도.
- 대응행동 오른쪽 체크박스: 체크=했다, 미체크=안 했다. 시나리오별 5개 예시 항목.
- 미선택/빈 근거는 제출 금지. 확인 취소와 X/ESC 닫기는 현재 답안 유지.
- 확인한 답안의 사본을 제출. 평가 중에는 중복 제출과 X/ESC 닫기를 막음.
- 대기 중 조사 팁 순환 표시. 오류 시 다시 판단하기 또는 입력창 복귀.
- 결과: 점수/잘한 점/부족한 점/예방 팁. 다시도전하기는 방으로 돌아가 추가 조사하는 것.
- 재도전/창 닫기는 메모와 조사 및 입력 내용 유지. 새 게임 시작 때 모든 플레이 데이터 초기화.

## 실제 AI 연결 상태

기본은 테스트 평가입니다. 화면에 실제 AI가 아님을 표시합니다.
규칙 점수는 입력 길이와 체크 수로 동작을 확인할 뿐 정답·근거의 타당성을 평가하지 않습니다.
실제 AI 모델, API 키, 백엔드, 채점 기준은 포함하지 않았습니다.

실제 서버가 준비되면 .env.example을 .env.local로 복사하고 다음을 설정하세요.

```env
VITE_EVALUATION_URL=/api/evaluate
VITE_DEMO_FAIL_ONCE=false
```

설정 후 Vite를 재실행합니다. /api/evaluate를 프런트 개발 서버가 자동으로 만들지는 않습니다.
백엔드 라우팅 또는 Vite 프록시/동일 출처 배포가 별도로 필요합니다.
VITE 변수는 브라우저에 공개되므로 API 키를 넣지 마세요. AI API 키는 백엔드에서 관리하세요.

## 요청 JSON

POST, Content-Type: application/json

```json
{
  "schemaVersion": 1,
  "requestId": "요청 고유 ID",
  "scenarioId": 1,
  "verdict": "scam",
  "reason": "조사한 사실을 근거로 한 설명",
  "responseActions": [{ "id": "official", "done": true }],
  "investigation": {
    "memo": "현재 메모",
    "objects": ["smartphone", "door"],
    "questions": [],
    "computerPages": []
  }
}
```

verdict는 normal 또는 scam. responseActions에는 해당 시나리오의 모든 항목이 true/false로 포함됩니다.
서버는 scenarioId로 자기 쪽의 확정 시나리오/정답/평가 기준을 조회해야 합니다.
클라이언트에 들어온 조사 여부만으로 실제 조사나 정답을 신뢰하지 마세요.
같은 requestId의 재시도는 서버에서 중복 처리하지 않도록 구현하는 것을 권장합니다.

## 응답 JSON

```json
{
  "score": 85,
  "strengths": ["잘한 점"],
  "improvements": ["보완할 근거"],
  "preventionTips": ["예방 팁"]
}
```

score는 0~100 숫자, 나머지 세 필드는 문자열 배열이어야 합니다.
필드 누락/범위 오류/HTTP 오류/20초 시간초과는 오류 화면으로 처리합니다.
실제 외부 서버 연결은 미검증이며, 계약 형태의 가짜 서버 응답으로 어댑터를 자동 검사했습니다.

## 코드 수정 위치

- src/game/doorUI.js: 입력/확인/대기/결과 화면과 제출 수명주기.
- src/game/evaluation.js: 대응행동 문구, 대기 팁, 요청/응답 검증, 테스트 평가 및 API 어댑터.
- src/game/state.js: 답안·최근 제출·평가 결과 저장.
- src/game/overlay.css: 큰 입력창, 체크박스, 선택 강조, 피드백 표시.
