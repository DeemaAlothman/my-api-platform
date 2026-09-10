-- Change overallRating from INT to FLOAT to support decimal values
ALTER TABLE evaluation."ProbationEvaluation"
  ALTER COLUMN "overallRating" TYPE DOUBLE PRECISION;
