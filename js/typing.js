/**
 * 打字比对核心逻辑
 * 给定目标单词和用户输入，生成每个字符格子的状态
 */
window.Typing = (function () {
  /**
   * @param {string} target 目标单词
   * @param {string} input  用户输入
   * @returns {Array<{char: string, status: 'pending'|'correct'|'wrong'|'active'}>}
   */
  function compare(target, input) {
    const result = [];
    for (let i = 0; i < target.length; i++) {
      const targetChar = target[i];
      if (i < input.length) {
        result.push({
          char: targetChar,
          status: input[i] === targetChar ? "correct" : "wrong",
        });
      } else if (i === input.length) {
        result.push({ char: targetChar, status: "active" });
      } else {
        result.push({ char: targetChar, status: "pending" });
      }
    }
    return result;
  }

  function isComplete(target, input) {
    return input.length === target.length;
  }

  function isExact(target, input) {
    return input === target;
  }

  return { compare, isComplete, isExact };
})();