/** SKILLs 场景示例，展示 App 怎样选择方法并保留自己的资料读取与输出格式。 */
export default [
  {
    id: 'task-skill-selection',
    title: '在资料问答中选用取证方法',
    layer: 'skills',
    matches: ['taskSkills', 'TaskSkill', 'TaskSkillId'],
    summary: '在已取得本题资料的 handler 中组合通用方法和问题。',
    details:
      '从 taskSkills 取出所选方法的正文，交给已绑定本次请求的模型。来源读取、引用核验和交付格式由 App 负责。',
    examples: [
      {
        title: '用已读来源构造该题的消息',
        level: '入门',
        environment: 'Node.js',
        ts: `import { taskSkills } from '@jangts/agent-core/skills';
import type { ModelMessage } from '@jangts/agent-core';

export function questionMessages(question: string, sources: { id: string; text: string }[]): ModelMessage[] {
  return [
    { role: 'system', content: taskSkills['evidence-answering'].instructions },
    { role: 'user', content: JSON.stringify({ question, sources }) },
  ];
}`,
      },
    ],
  },
];
