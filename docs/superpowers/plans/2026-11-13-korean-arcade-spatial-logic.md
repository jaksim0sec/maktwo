# Korean Arcade Spatial Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. Steps use checkbox syntax.

**Goal:** 한국식 상가 입면과 실내 분리, 의미별 부품 배치를 현재 도시 실험에 적용한다.

**Architecture:** 평면 데이터는 건물 생성기에서 닫힌 점포·서비스실로 정리하고, 도시 스탬프는 용도별 입면 결정기를 호출한다. 근거리 실내 접근과 원거리 건물 실루엣을 모두 유지한다.

**Tech Stack:** Vanilla ESM JavaScript, Node test, WebGL2 voxel mesher

**Spec:** docs/superpowers/specs/2026-11-13-korean-arcade-spatial-logic-design.md

## Global Constraints
- AGENTS.md 없음(원격 tree 확인), 기존 세계 설정 및 블록 ID/저장 포맷 변경 금지
- 새 도시 엔진 생성 금지, 재현 가능한 결정론 유지, 기존 입구·계단·교량 경로 유지

## Review Focus
- 출입구가 서/북/동/남에 놓이는 소형 점포의 가벽·뒷방 방향
- 다층 상가의 실내 가벽과 열린 문, 조명과 계단
- 저층 상가 이외의 주거·공방 외관이 상가 전면과 혼동되지 않음
- 좁은 부지·앵커 기반 대형 빌딩·옥상 증축의 구조 회귀
- 메싱/월드 저장/브라우저 렌더링 미검증 부분은 보고에서 분리

### Task 1: Interior rooms and storefront orientation
**Files:** `src/worldgen/eternal-night-buildings.js`, `test/eternal-night-commercial-architecture.test.mjs`
- [ ] RED: 소형 점포의 네 방향 출입구와 서비스실 구획 검사
- [ ] GREEN: 실제 입구가 있는 정면과 뒤편 부속실 구획을 일치시킴
- [ ] RED/GREEN: 고층 건물 시장층의 길고 비어 있는 버퍼를 분할된 점포/창고로 치환

### Task 2: Context-aware facade
**Files:** `src/worldgen/eternal-night-facade.js`, `src/worldgen/eternal-night-game.js`, `test/eternal-night-commercial-architecture.test.mjs`
- [ ] RED: 점포·주거·공방 입면 패턴, 전면부 간판/설비 규칙 검사
- [ ] GREEN: 창·벽·셔터·간판·배기구를 용도/층/입구에만 배치
- [ ] 확인: 구조/장식이 같은 복셀을 무의미하게 덮어쓰지 않음

### Task 3: Dense street cluster and regressions
**Files:** `src/worldgen/eternal-night-precincts.js`, `test/eternal-night-commercial-architecture.test.mjs`
- [ ] RED/GREEN: 골목 쪽 작은 점포를 우선 배치하고 부지 여백 축소
- [ ] 구형/신형 도시 생성 경로 격리와 정해진 층고·교량·충돌 불변 확인
- [ ] 최종 커밋 전 브랜치 대조와 검증된 항목·미검증 항목 보고
