package com.scamguard.backend.scenario;

import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ScenarioService {

    private final JdbcTemplate jdbcTemplate;

    public ScenarioService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> getScenarios() {

        String sql = """
            SELECT
                scenario_id AS "scenarioId",
                title,
                description,
                is_active AS "isActive"
            FROM scenario
            ORDER BY CASE scenario_id
                WHEN 'JOB' THEN 1
                WHEN 'SIDE' THEN 2
                WHEN 'INV' THEN 3
                WHEN 'TRAVEL' THEN 4
                ELSE 5
            END
            """;

        return jdbcTemplate.queryForList(sql);
    }
}