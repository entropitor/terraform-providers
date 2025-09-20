import {} from "@atcute/tangled";

import { follow } from "./follow.js";
import { knot } from "./knot.js";
import { knotMember } from "./knotMember.js";
import { profile } from "./profile.js";
import { publicKey } from "./publicKey.js";
import { repository } from "./repo.js";
import { repositoryCollaborator } from "./repoCollaborator.js";

export const tangledResources = {
  knot,
  knotMember,
  follow,
  profile,
  publicKey,
  repository,
  repositoryCollaborator,
} as const;
