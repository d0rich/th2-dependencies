import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
import { Octokit } from "octokit";

const octokit = new Octokit();

export type Repository = GetResponseDataTypeFromEndpointMethod< typeof octokit.rest.repos.get >
export type Repositories = GetResponseDataTypeFromEndpointMethod< typeof octokit.rest.repos.listForOrg >