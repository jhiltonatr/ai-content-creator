import { useState } from 'react';

interface ProductivityBarProps {
  storyWords: number;
  nodeWords: number | null;
  sessionWords: number;
  dailyWords: number;
  goal: number;
  onGoalChange: (goal: number) => void;
}

export default function ProductivityBar({
  storyWords,
  nodeWords,
  sessionWords,
  dailyWords,
  goal,
  onGoalChange,
}: ProductivityBarProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(goal));

  const finishGoal = (commit: boolean) => {
    setEditingGoal(false);
    if (commit) {
      const next = Math.max(0, Math.round(Number(goalDraft) || 0));
      onGoalChange(next);
    }
    setGoalDraft(String(goal));
  };

  const pct = goal > 0 ? Math.min(100, Math.round((dailyWords / goal) * 100)) : 0;
  const reached = goal > 0 && dailyWords >= goal;

  return (
    <div className="prod-bar">
      <div className="prod-stats">
        <span className="prod-stat" title="Live word total across every node in this story">
          <strong>{storyWords.toLocaleString()}</strong> words
        </span>
        {nodeWords !== null && (
          <span className="prod-stat muted" title="Live word count of the open node">
            node <strong>{nodeWords.toLocaleString()}</strong>
          </span>
        )}
        <span className="prod-stat muted" title="Words added during this session (this tab)">
          session <strong>+{sessionWords.toLocaleString()}</strong>
        </span>
      </div>
      <div className="prod-daily" title="Today's goal — words added today">
        <span className="prod-daily-label">
          Today <strong>{dailyWords.toLocaleString()}</strong> /{' '}
          {editingGoal ? (
            <input
              className="goal-input"
              type="number"
              min={0}
              step={100}
              value={goalDraft}
              autoFocus
              onChange={(e) => setGoalDraft(e.target.value)}
              onBlur={() => finishGoal(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishGoal(true);
                if (e.key === 'Escape') finishGoal(false);
              }}
            />
          ) : (
            <button
              className="goal-btn"
              title="Set daily word goal"
              onClick={() => {
                setGoalDraft(String(goal));
                setEditingGoal(true);
              }}
            >
              {goal.toLocaleString()}
            </button>
          )}
          <span className="goal-unit">goal</span>
        </span>
        <div className={`prod-progress${reached ? ' done' : ''}`}>
          <div className="prod-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}