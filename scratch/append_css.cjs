const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('src/index.css');
let css = fs.readFileSync(cssPath, 'utf8');

const userEditCss = `
/* ==========================================================================
   USER EDIT MODAL STYLES
   ========================================================================== */
.user-edit-modal {
  background: var(--bg-main);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}
.user-edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--bg-border);
}
.user-edit-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-edit-title-icon {
  background: rgba(51,102,255,0.1);
  color: var(--primary);
  width: 40px; height: 40px;
  border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
}
.user-edit-title-wrap h2 {
  margin: 0; font-size: 1.1rem; color: var(--text-main); font-weight: 700;
}
.user-edit-title-wrap p {
  margin: 2px 0 0; font-size: 0.8rem; color: var(--text-muted);
}
.user-edit-close {
  background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;
}
.user-edit-body {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 24px;
  padding: 24px;
}
.user-edit-profile {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  text-align: center;
  border-right: 1px solid var(--bg-border);
  padding-right: 24px;
}
.user-edit-avatar-wrap {
  position: relative;
}
.user-edit-avatar {
  width: 100px; height: 100px; border-radius: 50%;
  background: var(--primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 2.5rem; font-weight: 700; overflow: hidden;
  border: 3px solid var(--bg-surface);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.user-edit-avatar-action {
  position: absolute; bottom: 0; right: 0;
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-main);
}
.user-edit-username-badge {
  background: var(--bg-hover); padding: 4px 10px; border-radius: var(--radius-sm);
  font-size: 0.75rem; color: var(--text-muted); font-weight: 600;
}
.user-edit-photo-actions {
  display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 12px;
}
.user-edit-photo-actions button {
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  padding: 8px; border-radius: var(--radius-sm);
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  color: var(--text-main); font-size: 0.85rem; font-weight: 600;
}
.user-edit-photo-actions button.danger {
  color: #ef4444; background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2);
}
.user-edit-tips {
  margin-top: auto;
  background: rgba(51,102,255,0.05); border: 1px solid rgba(51,102,255,0.1);
  padding: 12px; border-radius: var(--radius-md);
  display: flex; gap: 10px; text-align: left; font-size: 0.8rem; color: var(--text-muted);
}
.user-edit-tips strong { display: block; color: var(--text-main); margin-bottom: 2px; }
.user-edit-fields { display: flex; flex-direction: column; gap: 16px; }
.user-edit-field { display: flex; flex-direction: column; gap: 6px; }
.user-edit-field label { font-size: 0.85rem; font-weight: 600; color: var(--text-main); }
.user-edit-field input, .user-edit-field select, .user-edit-readonly {
  padding: 10px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--bg-border); background: var(--bg-surface);
  color: var(--text-main); font-size: 0.95rem; font-family: inherit;
  width: 100%; box-sizing: border-box;
}
.user-edit-readonly {
  background: var(--bg-hover); color: var(--text-muted); font-weight: 600; cursor: not-allowed;
}
.user-edit-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.user-edit-actions {
  display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap;
}
.user-edit-footer {
  padding: 16px 24px; border-top: 1px solid var(--bg-border);
  display: flex; justify-content: flex-end; gap: 12px; background: var(--bg-surface);
}
@media (max-width: 768px) {
  .user-edit-body { grid-template-columns: 1fr; }
  .user-edit-profile { border-right: none; border-bottom: 1px solid var(--bg-border); padding-right: 0; padding-bottom: 24px; }
}
`;

if (!css.includes('.user-edit-modal {')) {
  fs.writeFileSync(cssPath, css + "\n" + userEditCss);
  console.log('Appended user-edit styles');
} else {
  console.log('user-edit styles already exist');
}
