import { useState, useEffect, useRef } from 'react';

export interface ActionableIssue {
  id: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface UseCommandBarOptions {
  initialIssues?: ActionableIssue[];
  onIssueAction?: (issueId: string) => void;
}

export const useCommandBar = (options: UseCommandBarOptions = {}) => {
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close flyout on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFlyoutOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derive everything from props - NO internal state duplication
  const issues = options.initialIssues || [];
  const hasIssues = issues.length > 0;
  const visibleIssues = issues.slice(0, 2);
  const overflowIssues = issues.slice(2);
  const hasOverflow = overflowIssues.length > 0;

  const handleIssueAction = (issueId: string) => {
    options.onIssueAction?.(issueId);
    const issue = issues.find(i => i.id === issueId);
    if (issue?.action) {
      issue.action.onClick();
    }
    setIsFlyoutOpen(false);
  };

  return {
    issues,
    hasIssues,
    visibleIssues,
    overflowIssues,
    hasOverflow,
    isFlyoutOpen,
    setIsFlyoutOpen,
    containerRef,
    handleIssueAction,
  };
};