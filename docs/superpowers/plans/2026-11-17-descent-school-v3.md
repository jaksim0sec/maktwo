# 하강 V3 한국 학교 월드 Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans. Tests and verification before completion.

**Goal:** 독립 학교 V3 월드를 생성하고 월드 선택 메뉴에 등록한다.
**Architecture:** schoolVoxel(worldX,y,worldZ,seed) 순수 함수로 보셀을 결정하고 stampSchoolChunk로 전달한다. 기존 디스패처와 월드 레지스트리만 연결한다.
**Tech Stack:** Vanilla JS ES modules, WebGL2, Node built-in test
**Spec:** docs/superpowers/specs/2026-11-17-descent-school-v3-design.md

## Global Constraints
- legacy canyon-v2 생성기와 기존 월드 저장 이름 불변
- 새 월드 school-v3, 높이 64, 격자 주기 224
- 새 패키지와 블록 ID 추가 금지

## Tasks and checks
- [x] Task 1: src/worldgen/school-v3.js 독립 캠퍼스 생성기
- [x] Task 2: test/school-v3.test.mjs 학교 구조/결정성/슬롯 테스트 작성
- [x] Task 3: generators.js, world.js, catalog.js, world-slots.js, game.js에 새로운 모드 연결
- [x] Task 4: sw.js의 APP_FILES 및 캐시 버전 갱신
- [ ] Task 5: 원본 저장소 전체 npm test 통과 확인
- [ ] Task 6: 실제 PC/모바일 WebGL2 환경에서 학교 내부 동선 및 성능 검수

## Review Focus
- 월드 경계와 음수 좌표에서 반복 캠퍼스의 연결
- 계단과 층 상부의 플레이어 충돌
- 학교 생성 데이터가 이전 V2 저장 키를 쓰지 않는지
- PWA 오프라인 모듈 캐시가 불완전하지 않은지
- 기존 게임 월드 메뉴 및 새 게임 생성 동작

## Verification note
별도 로컬 하네스에서 school-v3 생성기 테스트 6개 통과. 전체 저장소 npm test / 브라우저 실측은 아직 수행하지 않았으며 완료 주장하지 않는다.