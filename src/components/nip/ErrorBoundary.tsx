"use client";

// NIP v3.0 — Error Boundary
// Catches runtime crashes in child components and shows a useful message
// instead of a blank screen. Includes a "Reload" button.

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 max-w-md">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
                {this.props.label ? `${this.props.label} crashed` : "Component crashed"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {this.state.error?.message ?? "Unknown error"}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.reload();
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
