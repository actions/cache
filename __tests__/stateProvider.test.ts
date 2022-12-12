import * as cache from "@actions/cache";
import * as core from "@actions/core";

import { Events, RefKey } from "../src/constants";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("@actions/cache");

beforeAll(() => {
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });
});

afterEach(() => {
    delete process.env[Events.Key];
    delete process.env[RefKey];
});
