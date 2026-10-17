import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractOptions, leadingChapter, splitProject } from '../src/args.js'

/**
 * Parsing is deliberately tolerant: a command that silently ignores what the
 * user typed reads as broken even when the code is right.
 */
test('chapter counts are recognised in the shapes people actually type', () => {
  for (const input of ['修仙 60章', '修仙 60 章', '修仙第60章', '修仙 60章节', '修仙 60章 --auto']) {
    assert.equal(extractOptions(input).chapters, 60, input)
  }
  // Full-width digits from a Chinese IME.
  assert.equal(extractOptions('修仙 ６０章').chapters, 60)
})

test('a consumed chapter token leaves no debris in the project name', () => {
  // Regression: "第60章" used to leave "第", and "60章节" left "节", which then
  // became part of the project name the command looked up.
  assert.equal(extractOptions('修仙第60章').rest, '修仙')
  assert.equal(extractOptions('修仙 60章节').rest, '修仙')
  assert.equal(extractOptions('修仙 60章').rest, '修仙')
})

test('flags are recognised with or without surrounding spaces', () => {
  assert.equal(extractOptions('修仙 --auto').auto, true)
  assert.equal(extractOptions('修仙--auto').auto, true)
  assert.equal(extractOptions('修仙 -a').auto, true)
  assert.equal(extractOptions('修仙 60章--auto').auto, true)
  assert.equal(extractOptions('修仙 自动分岔').auto, true)
  assert.equal(extractOptions('修仙 60章').auto, false)
})

test('word targets and flagged chapter counts still parse', () => {
  assert.equal(extractOptions('修仙 -c 60').chapters, 60)
  assert.equal(extractOptions('修仙 --chapters 60').chapters, 60)
  assert.equal(extractOptions('修仙 20万字').words, 20)
  assert.equal(extractOptions('修仙 20 万字').words, 20)
})

test('leadingChapter accepts bare, numbered and full-width forms', () => {
  for (const input of ['12', '第12章', '12章', '12 章', '第 12 章', '１２章']) {
    assert.equal(leadingChapter(input).chapter, 12, input)
  }
  assert.equal(leadingChapter('12章 要求').note, '要求')
  // A non-chapter word is left as the note rather than misread as a number.
  assert.equal(leadingChapter('要求').chapter, undefined)
})

test('project names match leniently and longest-first', () => {
  const names = ['修仙', '修仙2', '末影之龙']
  assert.equal(splitProject('修仙 要求', names).project, '修仙')
  assert.equal(splitProject('修仙2', names).project, '修仙2')
  // Quoted and bracketed forms survive a copy-paste from a document.
  assert.equal(splitProject('《末影之龙》 第1章', names).project, '末影之龙')
  assert.equal(splitProject('《末影之龙》 第1章', names).note, '第1章')
  assert.equal(splitProject('“修仙” 要求', names).project, '修仙')
  // An unknown leading word is a note, never a guessed project.
  assert.equal(splitProject('不存在的书 要求', names).project, undefined)
})
