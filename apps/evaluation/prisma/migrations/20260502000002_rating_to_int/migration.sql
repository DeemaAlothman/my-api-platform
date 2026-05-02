-- Convert ProbationRating enum to integer (1-5) in ProbationCriteriaScore
ALTER TABLE evaluation."ProbationCriteriaScore"
  ADD COLUMN "score_new" INT,
  ADD COLUMN "selfScore_new" INT;

UPDATE evaluation."ProbationCriteriaScore"
SET "score_new" = CASE score::text
  WHEN 'UNACCEPTABLE' THEN 1
  WHEN 'ACCEPTABLE'   THEN 2
  WHEN 'GOOD'         THEN 3
  WHEN 'VERY_GOOD'    THEN 4
  WHEN 'EXCELLENT'    THEN 5
  ELSE NULL
END;

UPDATE evaluation."ProbationCriteriaScore"
SET "selfScore_new" = CASE "selfScore"::text
  WHEN 'UNACCEPTABLE' THEN 1
  WHEN 'ACCEPTABLE'   THEN 2
  WHEN 'GOOD'         THEN 3
  WHEN 'VERY_GOOD'    THEN 4
  WHEN 'EXCELLENT'    THEN 5
  ELSE NULL
END;

ALTER TABLE evaluation."ProbationCriteriaScore"
  DROP COLUMN score,
  DROP COLUMN "selfScore";

ALTER TABLE evaluation."ProbationCriteriaScore"
  RENAME COLUMN "score_new" TO score;
ALTER TABLE evaluation."ProbationCriteriaScore"
  RENAME COLUMN "selfScore_new" TO "selfScore";

-- Convert overallRating in ProbationEvaluation
ALTER TABLE evaluation."ProbationEvaluation"
  ADD COLUMN "overallRating_new" INT;

UPDATE evaluation."ProbationEvaluation"
SET "overallRating_new" = CASE "overallRating"::text
  WHEN 'UNACCEPTABLE' THEN 1
  WHEN 'ACCEPTABLE'   THEN 2
  WHEN 'GOOD'         THEN 3
  WHEN 'VERY_GOOD'    THEN 4
  WHEN 'EXCELLENT'    THEN 5
  ELSE NULL
END;

ALTER TABLE evaluation."ProbationEvaluation"
  DROP COLUMN "overallRating";

ALTER TABLE evaluation."ProbationEvaluation"
  RENAME COLUMN "overallRating_new" TO "overallRating";

-- Drop the enum type
DROP TYPE IF EXISTS evaluation."ProbationRating";
