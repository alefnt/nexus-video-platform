/**
 * 👥 创作者协作组件
 * Creator Collaboration - 多人联合创作与收益分成
 */

import React, { useState } from 'react';
import { Users, Plus, X, Check, Percent, DollarSign, UserPlus, Share2, AlertCircle } from 'lucide-react';
import { AvatarFrame, AvatarFrameData } from './AvatarFrame';
import { useSound } from '../hooks/useSound';

export interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  avatarFrame?: AvatarFrameData;
  role: 'owner' | 'collaborator';
  revenueShare: number; // 百分比
  status: 'pending' | 'accepted' | 'rejected';
  joinedAt?: string;
}

export interface CollaborationData {
  id: string;
  videoId?: string;
  title: string;
  owner: Collaborator;
  collaborators: Collaborator[];
  status: 'draft' | 'pending' | 'active' | 'completed';
  totalRevenue?: number;
  createdAt: string;
}

interface CollaboratorCardProps {
  collaborator: Collaborator;
  onRemove?: () => void;
  onUpdateShare?: (share: number) => void;
  editable?: boolean;
}

const CollaboratorCard: React.FC<CollaboratorCardProps> = ({
  collaborator,
  onRemove,
  onUpdateShare,
  editable = false
}) => {
  const [share, setShare] = useState<number | string>(collaborator.revenueShare);

  return (
    <div className={`collaborator-card ${collaborator.status}`}>
      <AvatarFrame
        avatarUrl={collaborator.avatar}
        frame={collaborator.avatarFrame}
        size={48}
      />
      <div className="collab-info">
        <span className="collab-name">{collaborator.name}</span>
        <span className={`collab-status ${collaborator.status}`}>
          {collaborator.status === 'pending' && '等待确认'}
          {collaborator.status === 'accepted' && '已加入'}
          {collaborator.status === 'rejected' && '已拒绝'}
        </span>
      </div>
      <div className="collab-share">
        {editable && collaborator.role !== 'owner' ? (
          <div className="share-input-wrapper">
            <input
              type="number"
              min="1"
              max="99"
              value={share}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setShare(val);
                }
              }}
              onBlur={() => onUpdateShare?.(Number(share) || 0)}
              className="share-input"
            />
            <Percent size={12} />
          </div>
        ) : (
          <span className="share-value">{collaborator.revenueShare}%</span>
        )}
      </div>
      {editable && collaborator.role !== 'owner' && (
        <button className="remove-btn" onClick={onRemove}>
          <X size={16} />
        </button>
      )}
      {collaborator.role === 'owner' && (
        <span className="owner-badge">创建者</span>
      )}

      <style>{`
        .collaborator-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .collaborator-card:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .collaborator-card.pending {
          border-color: rgba(255, 193, 7, 0.3);
        }

        .collaborator-card.rejected {
          opacity: 0.5;
        }

        .collab-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .collab-name {
          font-size: 14px;
          font-weight: 500;
        }

        .collab-status {
          font-size: 11px;
          color: var(--text-muted);
        }

        .collab-status.accepted {
          color: var(--status-success);
        }

        .collab-status.rejected {
          color: var(--status-error);
        }

        .collab-share {
          display: flex;
          align-items: center;
        }

        .share-input-wrapper {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          padding: 4px 8px;
        }

        .share-input {
          width: 40px;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 14px;
          text-align: right;
        }

        .share-input::-webkit-inner-spin-button {
          display: none;
        }

        .share-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--accent-cyan);
        }

        .remove-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 100, 100, 0.1);
          border: none;
          border-radius: 6px;
          color: var(--status-error);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .remove-btn:hover {
          background: rgba(255, 100, 100, 0.2);
        }

        .owner-badge {
          font-size: 10px;
          padding: 4px 8px;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
          border-radius: 10px;
          color: #fff;
        }
      `}</style>
    </div>
  );
};

interface CreatorCollaborationProps {
  collaboration?: CollaborationData;
  mode: 'create' | 'view' | 'manage';
  onInvite?: (userId: string, share: number) => void;
  onRemove?: (userId: string) => void;
  onUpdateShare?: (userId: string, share: number) => void;
  onConfirm?: () => void;
}

export const CreatorCollaboration: React.FC<CreatorCollaborationProps> = ({
  collaboration,
  mode,
  onInvite,
  onRemove,
  onUpdateShare,
  onConfirm
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteShare, setInviteShare] = useState<number | string>('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const { play: playSound } = useSound();

  // 计算总分成
  const totalShare = collaboration
    ? collaboration.owner.revenueShare +
    collaboration.collaborators.reduce((sum, c) => sum + c.revenueShare, 0)
    : 0;

  const remainingShare = 100 - totalShare + (collaboration?.owner.revenueShare || 0);

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;

    playSound('success');
    onInvite?.(inviteEmail, Number(inviteShare) || 0);
    setInviteEmail('');
    setInviteShare('');
    setShowInviteForm(false);
  };

  return (
    <>
      <div className="collab-container">
        {/* 标题 */}
        <div className="collab-header">
          <div className="header-title">
            <Users size={20} />
            <h3>创作者协作</h3>
          </div>
          {mode !== 'view' && (
            <button
              className="add-collab-btn"
              onClick={() => {
                playSound('click');
                setShowInviteForm(true);
              }}
            >
              <UserPlus size={16} />
              邀请协作者
            </button>
          )}
        </div>

        {/* 说明 */}
        <div className="collab-info-box">
          <AlertCircle size={16} />
          <p>邀请其他创作者共同创作，收益将按比例自动分成。所有协作者确认后，分成比例将锁定。</p>
        </div>

        {/* 分成预览 */}
        <div className="share-preview">
          <div className="share-bar">
            {collaboration && (
              <>
                <div
                  className="share-segment owner"
                  style={{ width: `${collaboration.owner.revenueShare}%` }}
                  title={`${collaboration.owner.name}: ${collaboration.owner.revenueShare}%`}
                />
                {collaboration.collaborators.map((c, i) => (
                  <div
                    key={c.id}
                    className={`share-segment collab-${i % 4}`}
                    style={{ width: `${c.revenueShare}%` }}
                    title={`${c.name}: ${c.revenueShare}%`}
                  />
                ))}
              </>
            )}
          </div>
          <div className="share-labels">
            <span>总分成: {totalShare}%</span>
            {totalShare !== 100 && (
              <span className="share-warning">需等于 100%</span>
            )}
          </div>
        </div>

        {/* 协作者列表 */}
        <div className="collaborators-list">
          {collaboration && (
            <>
              <CollaboratorCard
                collaborator={collaboration.owner}
                editable={mode === 'create'}
                onUpdateShare={(share) => onUpdateShare?.(collaboration.owner.id, share)}
              />
              {collaboration.collaborators.map((collab) => (
                <CollaboratorCard
                  key={collab.id}
                  collaborator={collab}
                  editable={mode === 'create'}
                  onRemove={() => onRemove?.(collab.id)}
                  onUpdateShare={(share) => onUpdateShare?.(collab.id, share)}
                />
              ))}
            </>
          )}
        </div>

        {/* 收益统计（仅完成状态显示） */}
        {collaboration?.status === 'completed' && collaboration.totalRevenue && (
          <div className="revenue-summary">
            <div className="revenue-header">
              <DollarSign size={18} />
              <span>收益分成</span>
            </div>
            <div className="revenue-list">
              <div className="revenue-item">
                <span>{collaboration.owner.name}</span>
                <span className="revenue-amount">
                  {((collaboration.totalRevenue * collaboration.owner.revenueShare) / 100).toFixed(2)} 积分
                </span>
              </div>
              {collaboration.collaborators.map((c) => (
                <div key={c.id} className="revenue-item">
                  <span>{c.name}</span>
                  <span className="revenue-amount">
                    {((collaboration.totalRevenue! * c.revenueShare) / 100).toFixed(2)} 积分
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 确认按钮 */}
        {mode === 'create' && totalShare === 100 && (
          <button className="confirm-btn" onClick={onConfirm}>
            <Check size={16} />
            确认协作
          </button>
        )}

        {/* 邀请表单 */}
        {showInviteForm && (
          <div className="invite-overlay" onClick={() => setShowInviteForm(false)}>
            <div className="invite-form" onClick={e => e.stopPropagation()}>
              <h4>邀请协作者</h4>
              <div className="form-group">
                <label>用户邮箱、ID 或 钱包地址</label>
                <input
                  type="text"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="请输入邮箱 / ID / 钱包地址"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>分成比例</label>
                <div className="share-input-wrapper">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    max={remainingShare}
                    value={inviteShare}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setInviteShare(val);
                      }
                    }}
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                  <span className="share-display">%</span>
                </div>
              </div>
              <div className="form-actions">
                <button className="cancel-btn" onClick={() => setShowInviteForm(false)}>
                  取消
                </button>
                <button className="invite-btn" onClick={handleInvite}>
                  <Share2 size={14} />
                  发送邀请
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .collab-container {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 20px;
        }

        .collab-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header-title h3 {
          font-size: 16px;
          font-weight: 600;
        }

        .header-title svg {
          color: var(--accent-cyan);
        }

        .add-collab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
          border: none;
          border-radius: 20px;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .add-collab-btn:hover {
          transform: scale(1.05);
        }

        .collab-info-box {
          display: flex;
          gap: 10px;
          padding: 12px;
          background: rgba(0, 245, 212, 0.05);
          border: 1px solid rgba(0, 245, 212, 0.2);
          border-radius: 10px;
          margin-bottom: 16px;
        }

        .collab-info-box svg {
          color: var(--accent-cyan);
          flex-shrink: 0;
        }

        .collab-info-box p {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        /* 分成预览条 */
        .share-preview {
          margin-bottom: 16px;
        }

        .share-bar {
          display: flex;
          height: 12px;
          background: rgba(100, 100, 100, 0.3);
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .share-segment {
          transition: width 0.3s ease;
        }

        .share-segment.owner {
          background: linear-gradient(90deg, var(--accent-purple), var(--accent-pink));
        }

        .share-segment.collab-0 {
          background: linear-gradient(90deg, #4D61FC, #00D9FF);
        }

        .share-segment.collab-1 {
          background: linear-gradient(90deg, #00F5D4, #00D9FF);
        }

        .share-segment.collab-2 {
          background: linear-gradient(90deg, #FFD93D, #FF9F43);
        }

        .share-segment.collab-3 {
          background: linear-gradient(90deg, #FF6B9D, #FF2E93);
        }

        .share-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted);
        }

        .share-warning {
          color: var(--status-warning);
        }

        /* 协作者列表 */
        .collaborators-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }

        /* 收益统计 */
        .revenue-summary {
          background: rgba(0, 245, 212, 0.05);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .revenue-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: var(--accent-cyan);
          font-weight: 600;
        }

        .revenue-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .revenue-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .revenue-amount {
          font-weight: 600;
          color: var(--accent-cyan);
        }

        /* 确认按钮 */
        .confirm-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .confirm-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 0 20px rgba(162, 103, 255, 0.4);
        }

        /* 邀请表单弹窗 */
        .invite-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .invite-form {
          background: var(--bg-elevated);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 360px;
        }

        .invite-form h4 {
          font-size: 18px;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 6px;
        }

        .form-input {
          width: 100%;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--accent-purple);
        }

        .share-input-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .share-slider {
          flex: 1;
          -webkit-appearance: none;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .share-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          background: var(--accent-purple);
          border-radius: 50%;
          cursor: pointer;
        }

        .share-display {
          font-size: 16px;
          font-weight: 600;
          color: var(--accent-cyan);
          min-width: 40px;
          text-align: right;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .cancel-btn {
          flex: 1;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .invite-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </>
  );
};

export default CreatorCollaboration;
