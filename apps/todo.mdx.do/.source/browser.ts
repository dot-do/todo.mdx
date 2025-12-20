// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"cli.mdx": () => import("../content/docs/cli.mdx?collection=docs"), "components.mdx": () => import("../content/docs/components.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "integration.mdx": () => import("../content/docs/integration.mdx?collection=docs"), }),
};
export default browserCollections;