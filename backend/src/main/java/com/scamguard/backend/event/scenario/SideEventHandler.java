package com.scamguard.backend.event.scenario;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.scamguard.backend.event.EventContext;
import com.scamguard.backend.event.EventHandler;
import com.scamguard.backend.event.EventResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class SideEventHandler implements EventHandler {

    @Override
    public boolean supports(String scenarioId, String eventName) {
        return "SIDE".equals(scenarioId)
                && "WORK_TASK_COMPLETED".equals(eventName);
    }

    @Override
    public EventResult handle(EventContext context) {

        String taskId = context.targetId();
        String selectedResult = context.selectedResult();

        JsonNode content = context.content();
        ObjectNode state = context.state();

        if (!"NORMAL".equals(selectedResult)
                && !"ERROR".equals(selectedResult)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "검수 결과는 NORMAL 또는 ERROR여야 합니다."
            );
        }

        JsonNode task = findTask(
                content.path("workTasks"),
                taskId
        );

        if (!containsId(
                state.path("unlockedTaskIds"),
                taskId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "아직 수행할 수 없는 업무입니다."
            );
        }

        JsonNode existingResults =
                state.path("completedTaskResults");

        ObjectNode completedTaskResults;

        if (existingResults.isMissingNode()) {
            completedTaskResults = state.objectNode();

            state.set(
                    "completedTaskResults",
                    completedTaskResults
            );
        } else if (existingResults.isObject()) {
            completedTaskResults = (ObjectNode) existingResults;
        } else {
            throw new IllegalStateException(
                    "업무 완료 상태 데이터가 올바르지 않습니다."
            );
        }

        if (completedTaskResults.has(taskId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 완료한 검수 업무입니다."
            );
        }

        String correctResult =
                task.path("correctResult").asText();

        if (!"NORMAL".equals(correctResult)
                && !"ERROR".equals(correctResult)) {
            throw new IllegalStateException(
                    "업무 정답 데이터가 올바르지 않습니다: "
                            + taskId
            );
        }

        boolean correct =
                correctResult.equals(selectedResult);

        JsonNode rewardNode = task.path("reward");

        if (!rewardNode.isIntegralNumber()
                || !rewardNode.canConvertToInt()
                || rewardNode.asInt() < 0) {

            throw new IllegalStateException(
                    "업무 보수 데이터가 올바르지 않습니다: "
                            + taskId
            );
        }

        int reward = rewardNode.asInt();

        ObjectNode taskResult = state.objectNode();

        taskResult.put("selectedResult", selectedResult);
        taskResult.put("correct", correct);
        taskResult.put("reward", reward);

        completedTaskResults.set(
                taskId,
                taskResult
        );

        Map<String, Object> interaction =
                new LinkedHashMap<>();

        interaction.put("id", taskId);

        interaction.put(
                "taskNumber",
                task.path("taskNumber").asText()
        );

        interaction.put(
                "selectedResult",
                selectedResult
        );

        interaction.put("correct", correct);
        interaction.put("completed", true);

        return new EventResult(interaction);
    }

    private JsonNode findTask(
            JsonNode tasks,
            String taskId
    ) {
        if (tasks.isArray()) {
            for (JsonNode task : tasks) {

                if (taskId.equals(
                        task.path("id").asText()
                )) {
                    return task;
                }
            }
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "존재하지 않는 업무 ID입니다: " + taskId
        );
    }

    private boolean containsId(
            JsonNode ids,
            String targetId
    ) {
        if (!ids.isArray()) {
            return false;
        }

        for (JsonNode id : ids) {
            if (targetId.equals(id.asText())) {
                return true;
            }
        }

        return false;
    }
}