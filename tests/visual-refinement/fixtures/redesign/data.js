// Local demonstration only. This module owns data and permission/mutation behavior.
export const tickets = [
  { id: 'T-101', title: '导出报表失败', description: '月底汇总时导出失败，需要保留筛选条件并重新尝试。', status: '待处理', priority: '紧急', owner: '未分派', canAssign: true },
  { id: 'T-102', title: '移动端长标题与权限说明在窄屏下需要完整可读且不遮挡主要操作', description: '仅查看权限的演示工单，不能分派。', status: '处理中', priority: '普通', owner: '陈明', canAssign: false },
  { id: 'T-103', title: '登录提示需要说明下一步', description: '提供明确的恢复动作，避免重复提交。', status: '待处理', priority: '普通', owner: '未分派', canAssign: true }
];
export function findTickets(search = '', status = '全部') {
  return tickets.filter(item => (status === '全部' || item.status === status) && `${item.id} ${item.title} ${item.description}`.includes(search.trim()));
}
export function assignTicket(id, owner, fail = false) {
  const item = tickets.find(ticket => ticket.id === id);
  if (!item || !item.canAssign) throw new Error('没有分派权限');
  if (!owner.trim()) throw new Error('请选择处理人');
  if (fail) throw new Error('模拟请求失败，请重试');
  item.owner = owner;
  item.status = '处理中';
  return item;
}
