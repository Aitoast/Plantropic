-- Planora — PostgreSQL 스키마
-- 사용자별 일정 격리 + AI 분석 친화적 정규화 구조
-- 실행:  psql "$DATABASE_URL" -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ── 사용자 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  password_hash  TEXT,                    -- 소셜 전용 계정이면 NULL
  avatar_url     TEXT,
  timezone       TEXT NOT NULL DEFAULT 'Asia/Seoul',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 소셜 로그인 연동 (한 사용자가 여러 provider 연결 가능)
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,            -- 'google' | 'kakao'
  provider_uid  TEXT NOT NULL,            -- provider가 주는 고유 id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_uid)
);

-- ── 캘린더(카테고리) ─────────────────────────────────────
-- 프론트의 6종 카테고리(personal/work/meeting/deadline/team/family)를 테이블로.
CREATE TABLE IF NOT EXISTS calendars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,               -- 'personal' 등
  label      TEXT NOT NULL,               -- '내 일정'
  color      TEXT NOT NULL,               -- '#1f8a5b'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

-- ── 일정 ─────────────────────────────────────────────────
-- 프론트의 day/start(소수시간)를 절대 시각으로 정규화 → 시간대·충돌·이동시간 계산 용이.
CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_id  UUID NOT NULL REFERENCES calendars(id) ON DELETE RESTRICT,
  title        TEXT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,      -- 시작 시각
  ends_at      TIMESTAMPTZ NOT NULL,      -- 종료 시각
  all_day      BOOLEAN NOT NULL DEFAULT false,
  location     TEXT,                      -- 장소 (지오코딩 확장 여지)
  summary      TEXT,                      -- 요약/메모 → AI 분석 입력
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_events_user_time ON events (user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_calendar  ON events (calendar_id);

-- ── AI 인사이트 캐시 (에이전트 결과 저장) ───────────────
-- 규칙 레이어 + LLM 요약 결과를 기간 단위로 저장해 재호출 비용 절감.
CREATE TABLE IF NOT EXISTS ai_insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  kind         TEXT NOT NULL,             -- 'weekly_summary' | 'conflict' | 'suggestion'
  payload      JSONB NOT NULL,            -- 구조화된 결과
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insights_user ON ai_insights (user_id, period_start);

-- 신규 가입 시 기본 캘린더 6종을 넣는 헬퍼(앱에서 호출하거나 트리거로 확장 가능)
-- INSERT INTO calendars(user_id,key,label,color) VALUES
--   ($1,'personal','내 일정','#1f8a5b'), ($1,'work','업무','#3b6fd4'),
--   ($1,'meeting','회의','#7c5cdb'),     ($1,'deadline','마감','#d97757'),
--   ($1,'team','팀 공유','#0e9aa7'),      ($1,'family','가족','#d95a97');
