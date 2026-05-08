(function attachBackgroundStep5(root, factory) {
  root.MultiPageBackgroundStep5 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep5Module() {
  function createStep5Executor(deps = {}) {
    const {
      addLog,
      completeStepFromBackground,
      generateRandomBirthday,
      generateRandomName,
      getTabId,
      sendToContentScript,
      waitForTabUrlMatch,
    } = deps;

    function isStep5PostSubmitHomeUrl(rawUrl = '') {
      const url = String(rawUrl || '').trim();
      if (!url) {
        return false;
      }

      try {
        const parsed = new URL(url);
        return parsed.hostname.toLowerCase() === 'chatgpt.com'
          && parsed.pathname === '/'
          && !parsed.search
          && !parsed.hash;
      } catch {
        return false;
      }
    }

    async function executeStep5() {
      const { firstName, lastName } = generateRandomName();
      const { year, month, day } = generateRandomBirthday();

      await addLog(`步骤 5：已生成姓名 ${firstName} ${lastName}，生日 ${year}-${month}-${day}`);

      const tabId = typeof getTabId === 'function'
        ? await getTabId('signup-page')
        : null;

      const submitResult = await sendToContentScript('signup-page', {
        type: 'EXECUTE_NODE',
        nodeId: 'fill-profile',
        step: 5,
        source: 'background',
        payload: {
          firstName,
          lastName,
          year,
          month,
          day,
          waitForPostSubmitInContent: false,
        },
      });

      if (submitResult?.postSubmitConfirmed) {
        return submitResult;
      }

      if (!Number.isInteger(tabId) || typeof waitForTabUrlMatch !== 'function') {
        throw new Error('步骤 5：后台无法检测注册资料提交后的页面 URL。');
      }

      await addLog('步骤 5：已提交注册资料，正在等待页面回到 https://chatgpt.com/');
      const matchedTab = await waitForTabUrlMatch(tabId, isStep5PostSubmitHomeUrl, {
        timeoutMs: 90000,
        retryDelayMs: 500,
      });

      if (!matchedTab) {
        throw new Error('步骤 5：提交注册资料后等待页面回到 https://chatgpt.com/ 超时。');
      }

      const completionPayload = {
        postSubmitConfirmed: true,
        postSubmitState: 'logged_in_home',
        postSubmitUrl: matchedTab.url || 'https://chatgpt.com/',
      };

      if (typeof completeStepFromBackground === 'function') {
        await completeStepFromBackground(5, completionPayload);
      }
      await addLog('步骤 5：注册资料提交已确认，页面已回到 https://chatgpt.com/', 'ok');
      return completionPayload;
    }

    return { executeStep5 };
  }

  return { createStep5Executor };
});
