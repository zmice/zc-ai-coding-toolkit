import { tickets, findTickets, assignTicket } from './data.js';
const $ = id => document.getElementById(id);
let selected, opener;
function render() {
  const rows = findTickets($('search').value, $('status').value);
  $('count').textContent = `${rows.length} 条工单`;
  $('list').innerHTML = rows.length ? `<table><thead><tr><th>编号</th><th>标题</th><th>状态</th><th>优先级</th><th>处理人</th><th>操作</th></tr></thead><tbody>${rows.map(t => `<tr><td>${t.id}</td><td>${t.title}</td><td>${t.status}</td><td>${t.priority}</td><td>${t.owner}</td><td><button data-id="${t.id}">查看详情 ${t.id}</button></td></tr>`).join('')}</tbody></table>` : '<p>没有匹配工单，请调整筛选。</p>';
}
$('search').addEventListener('input', render);
$('status').addEventListener('change', render);
$('clear').onclick = () => { $('search').value = ''; $('status').value = '全部'; render(); };
$('list').onclick = event => {
  const button = event.target.closest('button[data-id]'); if (!button) return;
  selected = tickets.find(t => t.id === button.dataset.id); opener = button;
  $('detail-title').textContent = `${selected.id} ${selected.title}`;
  $('description').textContent = selected.description;
  $('meta').textContent = `${selected.status} · ${selected.priority} · ${selected.owner}`;
  $('owner').value = ''; $('fail').checked = false;
  $('submit').disabled = !selected.canAssign;
  $('feedback').textContent = selected.canAssign ? '' : '没有分派权限';
  $('detail').showModal();
};
$('assign').onsubmit = event => { event.preventDefault(); try { assignTicket(selected.id, $('owner').value, $('fail').checked); $('feedback').textContent = '分派成功'; render(); } catch(error) { $('feedback').textContent = error.message; } };
$('close').onclick = () => $('detail').close();
$('detail').addEventListener('close', () => { const target = document.querySelector(`[data-id="${selected?.id}"]`); (target || opener)?.focus(); });
render();
