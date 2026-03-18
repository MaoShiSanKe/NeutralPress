import { redirect } from "next/navigation";

import LayoutEditorClientWrapper from "@/app/(admin)/admin/pages/block/[id]/LayoutEditorClientWrapper";
import {
  getPageByIdParam,
  resolveContentTypeEditorPath,
} from "@/app/(admin)/admin/pages/page-editor";
import LayoutEditorDesktopNotice from "@/components/client/features/page-editor/LayoutEditorDesktopNotice";
import AdminSidebar from "@/components/client/layout/AdminSidebar";
import HorizontalScroll from "@/components/client/layout/HorizontalScroll";
import MainLayout from "@/components/client/layout/MainLayout";
import { resolveBlockData } from "@/lib/server/block-data-resolver";
import { getClientUserAgent } from "@/lib/server/get-client-info";
import { getSystemPageConfig } from "@/lib/server/page-cache";
import { generateMetadata as generateSeoMetadata } from "@/lib/server/seo";

const MOBILE_UA_RE =
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(props: Props) {
  const { id } = await props.params;

  return generateSeoMetadata(
    {
      title: `管理面板/页面管理/布局编辑器/${id}`,
      description: `编辑页面布局：${id}`,
    },
    {
      pathname: `/admin/pages/block/${id}`,
    },
  );
}

export default async function BlockPageEditorPage({ params }: Props) {
  const { id } = await params;
  const page = await getPageByIdParam(id);

  if (!page) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        页面未找到: {id}
      </div>
    );
  }

  if (page.contentType !== "BLOCK") {
    redirect(resolveContentTypeEditorPath(page));
  }

  const userAgent = await getClientUserAgent();
  const isMobileRequest = MOBILE_UA_RE.test(userAgent);

  if (isMobileRequest) {
    return (
      <MainLayout type="horizontal">
        <HorizontalScroll className="h-full">
          <AdminSidebar />
          <div className="w-full overflow-y-auto">
            <LayoutEditorDesktopNotice />
          </div>
        </HorizontalScroll>
      </MainLayout>
    );
  }

  const config = getSystemPageConfig(page);
  const resolvedConfig = config
    ? await resolveBlockData(config as Parameters<typeof resolveBlockData>[0])
    : config;
  const resolvedPage = {
    ...page,
    config: (resolvedConfig || config) as typeof page.config,
  };

  return (
    <MainLayout type="horizontal">
      <HorizontalScroll className="h-full">
        <AdminSidebar />
        <div className="w-full overflow-y-auto">
          <LayoutEditorClientWrapper page={resolvedPage} />
        </div>
      </HorizontalScroll>
    </MainLayout>
  );
}
