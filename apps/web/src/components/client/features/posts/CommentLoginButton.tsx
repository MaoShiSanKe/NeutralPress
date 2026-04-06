"use client";

import { type ReactNode, startTransition, useEffect, useState } from "react";
import { RiGithubFill, RiGoogleFill, RiMicrosoftFill } from "@remixicon/react";

import type { OAuthProvider } from "@/lib/server/oauth";
import { Button } from "@/ui/Button";
import { Tooltip } from "@/ui/Tooltip";

interface CommentLoginButtonProps {
  enabledProviders: OAuthProvider[];
  onClick: () => void;
}

type LoginOption = {
  id: OAuthProvider;
  icon: ReactNode;
};

function getProviderIcon(provider: OAuthProvider): ReactNode {
  switch (provider) {
    case "google":
      return <RiGoogleFill size="1.15em" />;
    case "github":
      return <RiGithubFill size="1.15em" />;
    case "microsoft":
      return <RiMicrosoftFill size="1.15em" />;
  }
}

export function CommentLoginButton({
  enabledProviders,
  onClick,
}: CommentLoginButtonProps) {
  const enabledKey = enabledProviders.join(":");
  const options: LoginOption[] = enabledProviders.map((provider) => ({
    id: provider,
    icon: getProviderIcon(provider),
  }));
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [enabledKey]);

  useEffect(() => {
    if (options.length <= 1) return;

    const timer = window.setInterval(() => {
      startTransition(() => {
        setActiveIndex((prev) => (prev + 1) % options.length);
      });
    }, 2400);

    return () => window.clearInterval(timer);
  }, [enabledKey, options.length]);

  const currentOption = options[activeIndex];
  const tooltipContent =
    enabledProviders.length > 0
      ? "登录后继续评论，可使用已启用的 OAuth 快捷登录"
      : "登录到现有账号后继续发表评论";

  return (
    <Tooltip content={tooltipContent}>
      <Button
        label="登录"
        size="sm"
        variant="secondary"
        icon={currentOption?.icon}
        iconTransitionKey={currentOption?.id}
        className="justify-center"
        onClick={onClick}
      />
    </Tooltip>
  );
}
