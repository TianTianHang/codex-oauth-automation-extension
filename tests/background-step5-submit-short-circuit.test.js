const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/steps/fill-profile.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundStep5;`)(globalScope);

test('step 5 forwards generated profile data and relies on completion signal flow', async () => {
  const events = {
    completions: [],
    logs: [],
    messages: [],
  };
  const urlChecks = [
    'https://auth.openai.com/create-account/profile',
    'https://chatgpt.com/',
  ];

  const executor = api.createStep5Executor({
    addLog: async (message, level) => {
      events.logs.push({ message, level: level || 'info' });
    },
    completeStepFromBackground: async (step, payload) => {
      events.completions.push({ step, payload });
    },
    generateRandomBirthday: () => ({ year: 2003, month: 6, day: 19 }),
    generateRandomName: () => ({ firstName: 'Test', lastName: 'User' }),
    getTabId: async () => 42,
    sendToContentScript: async (source, message) => {
      events.messages.push({ source, message });
      return { submitted: true, pendingPostSubmitConfirmation: true };
    },
    waitForTabUrlMatch: async (tabId, matcher) => {
      assert.equal(tabId, 42);
      for (const url of urlChecks) {
        if (matcher(url, { url })) {
          return { id: tabId, url };
        }
      }
      return null;
    },
  });

  await executor.executeStep5();

  assert.deepStrictEqual(events.messages, [
    {
      source: 'signup-page',
      message: {
        type: 'EXECUTE_NODE',
        nodeId: 'fill-profile',
        step: 5,
        source: 'background',
        payload: {
          firstName: 'Test',
          lastName: 'User',
          year: 2003,
          month: 6,
          day: 19,
          waitForPostSubmitInContent: false,
        },
      },
    },
  ]);
  assert.deepStrictEqual(events.completions, [
    {
      step: 5,
      payload: {
        postSubmitConfirmed: true,
        postSubmitState: 'logged_in_home',
        postSubmitUrl: 'https://chatgpt.com/',
      },
    },
  ]);
  assert.ok(events.logs.some(({ message }) => /已生成姓名 Test User/.test(message)));
  assert.ok(events.logs.some(({ message }) => /页面已回到 https:\/\/chatgpt\.com\//.test(message)));
});
