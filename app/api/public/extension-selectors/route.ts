import { ok, handleApiError } from "src/lib/api";
import { cacheGetOrSet, cacheDel } from "src/lib/cache";

const DEFAULT_SELECTORS = {
  version: 1,
  updatedAt: new Date().toISOString(),
  selectors: {
    jobCards: [
      ".job-card-container",
      "[data-occludable-job-id]",
      "li.jobs-search-results__list-item",
      ".jobs-search-results-list__list-item",
      "li.scaffold-layout__list-item",
    ],
    easyApplySignal: [
      ".job-card-container__apply-method",
      ".job-card-list__apply-method",
      "[data-test-job-card-easy-apply]",
    ],
    detailRoots: [
      ".jobs-search__job-details",
      ".jobs-details",
      ".jobs-unified-top-card",
      ".jobs-details-top-card",
      ".scaffold-layout__detail",
    ],
    applyButtons: [
      "button.jobs-apply-button",
      ".jobs-s-apply button",
      "button[aria-label*='Apply']",
      "button[data-control-name*='jobdetails_topcard']",
    ],
    easyApplyButton: [
      "button.jobs-apply-button",
      "button[aria-label*='Easy Apply']",
      "button[aria-label*='Apply']",
    ],
    modal: [
      ".jobs-easy-apply-modal",
      ".artdeco-modal[role='dialog']",
    ],
    questionBlocks: [
      ".fb-dash-form-element",
      ".jobs-easy-apply-form-section__grouping",
      ".jobs-easy-apply-form-element",
      "div[data-test-form-element]",
      "div[data-test-form-builder-rating-field]",
      "div[data-test-text-entity-list-field]",
      "div[data-test-single-bleiben-address-field-form-element]",
      "div[data-test-date-picker-form-element]",
      "div[data-test-currency-input-form-element]",
      "div[data-test-phone-number-input-form-element]",
      "div[data-test-signature-form-element]",
      "fieldset",
    ],
    validationErrors: [
      ".artdeco-inline-feedback__message",
      "[role='alert']",
      ".fb-dash-form-element__error",
      ".jobs-easy-apply-form-element__error",
    ],
    searchInput: [
      "input.jobs-search-box__text-input",
      "input[aria-label*='Search by']",
      "input[placeholder*='Search']",
    ],
    jobTitle: ["h1"],
    companyName: [
      ".jobs-unified-top-card__company-name",
      ".jobs-details-top-card__company-url",
      ".job-details-jobs-unified-top-card__company-name",
    ],
    pagination: [
      "button[aria-label='Next']",
      "li.artdeco-pagination__indicator--number button",
    ],
    submitApplication: [
      "button[aria-label='Submit application']",
      "button[aria-label='Submit']",
      "footer button.artdeco-button--primary",
    ],
    nextButton: [
      "button[aria-label='Continue to next step']",
      "button[aria-label='Next']",
      "footer button.artdeco-button--primary",
    ],
  },
};

export async function GET() {
  try {
    const selectors = await cacheGetOrSet("extension:selectors", 300, async () => {
      return DEFAULT_SELECTORS;
    });
    return ok("Selectors fetched", selectors);
  } catch (error) {
    return handleApiError(error, "Failed to fetch selectors");
  }
}
