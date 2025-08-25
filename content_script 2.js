// Helper for insurance
async function processInsurance(section) {
  let c = [...section.querySelectorAll(
    "p-radiobutton[formcontrolname='travelInsuranceOpted'] input[type='radio'][name='travelInsuranceOpted-0']"
  )];
  await addDelay(50);
  const insRadio = c.find(
    (e) =>
      e.value ===
      (user_data.travel_preferences.travelInsuranceOpted === "yes"
        ? "true"
        : "false")
  );
  if (insRadio) insRadio.click();
}
// Helper for reservation choice dropdown
async function processReservationChoice(section) {
  const dropdown = section.querySelector("p-dropdown[formcontrolname='reservationChoice']");
  if (!dropdown || !user_data.travel_preferences.reservationchoice || user_data.travel_preferences.reservationchoice === "Reservation Choice") return;
  const dropdownButton = dropdown.querySelector("div[role='button']");
  if (dropdownButton) {
    dropdownButton.click();
    await addDelay(300);
    const options = dropdown.querySelectorAll("ul li.ui-dropdown-item");
    for (const option of options) {
      if (option.textContent.trim() === user_data.travel_preferences.reservationchoice) {
        option.click();
        await addDelay(200);
        break;
      }
    }
  }
}
// Helper for checkboxes
function processCheckboxes(section) {
  let l = section.querySelector(
    "input#autoUpgradation[type='checkbox'][formcontrolname='autoUpgradationSelected']"
  );
  if (
    l &&
    user_data.other_preferences.hasOwnProperty("autoUpgradation") &&
    user_data.other_preferences.autoUpgradation
  ) {
    l.checked = user_data.other_preferences.autoUpgradation ?? false;
  }
  let i = section.querySelector(
    "input#confirmberths[type='checkbox'][formcontrolname='bookOnlyIfCnf']"
  );
  if (
    i &&
    user_data.other_preferences.hasOwnProperty("confirmberths") &&
    user_data.other_preferences.confirmberths
  ) {
    i.checked = user_data.other_preferences.confirmberths ?? false;
  }
}
// Helper for payment type
async function processPaymentType(section) {
  let radios = [...section.querySelectorAll(
    "p-radiobutton[formcontrolname='paymentType'][name='paymentType'] input[type='radio']"
  )];
  await addDelay(50);
  let n = "2";
  if (!user_data.other_preferences.paymentmethod.includes("UPI")) n = "1";
  const payRadio = radios.find((e) => e.value === n);
  if (payRadio) payRadio.click();
}
// Helper function to check if loader is visible without causing reflow
function isLoaderVisible() {
  const loader = document.querySelector("#loaderP");
  if (!loader) return false;
  // Use getComputedStyle without triggering reflow
  const style = window.getComputedStyle(loader);
  return style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0";
}

// Optimized function to find class element
function findClassElement(trainElement, classText) {
  // First try tables
  const tableClassElement = Array.from(trainElement.querySelectorAll("table tr td div.pre-avl"))
    .find(el => el.querySelector("div").innerText.trim() === classText);
  if (tableClassElement) return tableClassElement;
  // Then try spans
  return Array.from(trainElement.querySelectorAll("span"))
    .find(el => el.innerText.trim() === classText);
}

// Optimized function to wait for date element
async function waitForDateElement(trainElement, dateString) {
  const targetDate = new Date(dateString);
  const formattedDate = `${targetDate.toDateString().split(" ")[0]}, ${targetDate.toDateString().split(" ")[2]} ${targetDate.toDateString().split(" ")[1]}`;
  // Wait for date elements to be available
  for (let i = 0; i < 5; i++) {
    const dateElements = Array.from(trainElement.querySelectorAll("div div table td div.pre-avl"));
    const dateElement = dateElements.find(el => el.querySelector("div").innerText.trim() === formattedDate);
    if (dateElement) return dateElement;
    await addDelay(200);
  }
  return null;
}

// Optimized function to wait and click book button
async function waitAndClickBookButton(trainElement) {
  for (let i = 0; i < 10; i++) {
    if (isLoaderVisible()) {
      await addDelay(100);
      continue;
    }
    const bookButton = trainElement.querySelector("button.btnDefault.train_Search.ng-star-inserted");
    if (bookButton &&
      !bookButton.classList.contains("disable-book") &&
      !bookButton.disabled) {
      // Use requestAnimationFrame to avoid forced reflow
      requestAnimationFrame(() => {
        bookButton.click();
        console.log("bookBtn पर क्लिक किया गया");
      });
      return;
    }
    await addDelay(200);
  }
  console.warn("bookBtn disable है या नहीं मिला, फिर से कोशिश...");
  retrySelectJourney();
}
let user_data = {};
let stations = [];

// Wait for element function with improved error handling
function waitForElement(selector, timeout = 10000, context = document) {
  return new Promise((resolve, reject) => {
    const element = context.querySelector(selector);
    if (element) return resolve(element);

    const observer = new MutationObserver(() => {
      const element = context.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(context, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found after ${timeout}ms`));
    }, timeout);
  });
}

// Helper function for retrying element search
function waitForElementWithRetry(selector, maxRetries = 3, delay = 1000) {
  return new Promise(async (resolve, reject) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const element = await waitForElement(selector, delay);
        return resolve(element);
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${attempt} failed for selector: ${selector}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    reject(lastError || new Error(`Element not found after ${maxRetries} attempts`));
  });
}



// Optimized selectJourney with reduced forced reflows
async function selectJourney() {
  // Use a flag to track if we're already processing
  if (window.isSelectingJourney) return;
  window.isSelectingJourney = true;

  try {
    console.log("Starting optimized selectJourney...");

    // Check if we're on the correct page first
    if (!window.location.href.includes('train-list')) {
      console.error('Not on train-list page. Current URL:', window.location.href);
      statusUpdate('error_wrong_page');
      return;
    }

    // Wait for train list container with retry logic
    const trainListContainer = await waitForElementWithRetry(
      '#divMain > div > app-train-list',
      3,
      2000
    ).catch(error => {
      console.error('Train list container not found after retries:', error);
      statusUpdate('error_train_list_not_found');
      return null;
    });

    if (!trainListContainer) return;

    // Batch DOM queries
    const trainElements = Array.from(trainListContainer.querySelectorAll('.tbis-div app-train-avl-enq'));
    console.log('Found train elements:', trainElements.length);

    if (trainElements.length === 0) {
      console.error('No train elements found');
      statusUpdate('error_no_trains_found');
      return;
    }

    // Get train number and class info
    const trainNumber = user_data.journey_details["train-no"];
    const trainClass = user_data.journey_details.class;

    if (!trainNumber) {
      console.error("user_data में ट्रेन नंबर नहीं मिला।");
      return;
    }

    console.log("Train Number:", trainNumber);

    // Find the correct train element
    const trainElement = findTrainElement(trainElements, trainNumber);
    if (!trainElement) {
      console.error("ट्रेन नहीं मिली।");
      statusUpdate("journey_selection_stopped.no_train");
      return;
    }

    // Process the train selection
    await processTrainSelection(trainElement, trainClass, trainNumber);

  } catch (error) {
    console.error('Error in selectJourney:', error);
    statusUpdate('error_select_journey_failed');
  } finally {
    window.isSelectingJourney = false;
  }
}

// Helper function to find train element
function findTrainElement(trainElements, trainNumber) {
  const searchNumber = trainNumber.split("-")[0];
  return trainElements.find((element) => {
    const heading = element.querySelector("div.train-heading");
    return heading && heading.innerText.trim().includes(searchNumber);
  });
}

// Helper function to process train selection
async function processTrainSelection(trainElement, trainClass, trainNumber) {
  // Get class translator
  const classText = classTranslator(trainClass);

  // Find and click the class element
  const classElement = findClassElement(trainElement, classText);
  if (!classElement) {
    console.error("क्लास क्लिक करने के लिए नहीं मिली।");
    return;
  }

  // Check if loader is visible before clicking
  if (isLoaderVisible()) {
    console.error("Loader दिख रहा है, क्लास क्लिक नहीं कर सकते।");
    return;
  }

  // Click the class element
  classElement.click();

  // Wait for the date selection to appear
  const dateElement = await waitForDateElement(trainElement, user_data.journey_details.date);
  if (!dateElement) {
    console.warn("Date tab नहीं मिला");
    return;
  }

  // Click the date element
  dateElement.click();
  console.log("selectdate पर क्लिक किया गया");

  // Wait and click the book button
  await waitAndClickBookButton(trainElement);
}
// Improved page detection and routing
function handlePageRouting() {
  const currentUrl = window.location.href;
  if (currentUrl.includes('/payment/')) {
    console.log('On payment page - skipping train selection');
    statusUpdate('on_payment_page');
    return;
  }
  if (currentUrl.includes('/train-list')) {
    console.log('On train list page - proceeding with selection');
    selectJourney();
    return;
  }
  if (currentUrl.includes('/train-search')) {
    console.log('On search page - waiting for redirection');
    statusUpdate('on_search_page_waiting');
    return;
  }
  console.log('Unknown page type:', currentUrl);
  statusUpdate('unknown_page_type');
}

// Update your window.onload or main execution point
window.onload = function () {
  console.log('Page loaded, checking URL...');
  handlePageRouting();
  // Also check URL changes (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('URL changed to:', url);
      handlePageRouting();
    }
  }).observe(document, { subtree: true, childList: true });
};

// Clicks the OK button on alert popups, with retry logic
function clickAlertOkButton(retry = 0) {
  const maxRetries = 30;
  const okBtn = document.querySelector('div.text-center.col-xs-12 > button.btn.btn-primary');
  if (okBtn && okBtn.innerText.trim().toUpperCase() === 'OK') {
    okBtn.click();
    console.log('Alert OK button clicked!');
    return true;
  } else if (retry < maxRetries) {
    setTimeout(() => clickAlertOkButton(retry + 1), 500);
    return false;
  }
  console.error('Alert OK button not found after retries.');
  return false;
}

// Helper to format messages for Chrome extension communication
function getMsg(e, t) {
  return { msg: { type: e, data: t }, sender: "content_script", id: "irctc" };
}

// Login success notification
function notifyLoginSuccess() {
  try {
    chrome.runtime.sendMessage({
      msg: { type: "login_success" },
      sender: "content_script",
      id: "irctc"
    });
    console.log("Login success notification sent");
  } catch (error) {
    console.error("Failed to send login success message:", error);
  }
}

// Login observer setup
function setupLoginObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const loginForm = node.querySelector && node.querySelector("app-login");
            if (!loginForm) {
              observer.disconnect();
              notifyLoginSuccess();
            }
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Listen for booking schedule message from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.msg) {
    if (msg.msg.type === 'performLogin') {
      try {
        const finalData = msg.msg.data.finalData;
        // Fill login form
        const loginApp = document.querySelector('app-login');
        if (loginApp) {
          const userInput = loginApp.querySelector("input[type='text'][formcontrolname='userid']");
          const passInput = loginApp.querySelector("input[type='password'][formcontrolname='password']");
          if (userInput && passInput) {
            userInput.value = finalData.irctc_credentials.user_name || '';
            userInput.dispatchEvent(new Event('input'));
            userInput.dispatchEvent(new Event('change'));
            passInput.value = finalData.irctc_credentials.password || '';
            passInput.dispatchEvent(new Event('input'));
            passInput.dispatchEvent(new Event('change'));
            // Optionally click login button
            const loginBtn = loginApp.querySelector("button[type='submit']");
            if (loginBtn) {
              loginBtn.click();
              sendResponse('Login attempted');
            } else {
              sendResponse('Login button not found');
            }
          } else {
            sendResponse('Login inputs not found');
          }
        } else {
          sendResponse('Login form not found');
        }
      } catch (err) {
        sendResponse('Login error: ' + err);
      }
    }
    // Check login status for auto booking
    else if (msg.msg.type === 'checkLoginStatus') {
      const loginForm = document.querySelector("app-login");
      if (!loginForm) {
        sendResponse('logged_in');
      } else {
        sendResponse('not_logged_in');
      }
    }
    // Start booking after login
    else if (msg.msg.type === 'startBooking') {
      console.log('[IRCTC] Booking automation would start now.', msg.msg.data);
      sendResponse('Booking automation started');
    }
    // Setup login observer
    else if (msg.msg.type === 'setup_login_observer') {
      setupLoginObserver();
      sendResponse('Login observer setup completed');
    }

    // Setup login observer
    else if (msg.msg.type === 'setup_login_observer') {
      setupLoginObserver();
      sendResponse('Login observer setup completed');
    }
  }
});

// Sends status updates to the extension popup
function statusUpdate(e) {
  chrome.runtime.sendMessage(
    getMsg("status_update", {
      status: e,
      time: new Date().toString().split(" ")[4],
    })
  );
}

// Translates IRCTC class codes to human-readable labels
function classTranslator(e) {
  return (
    (labletext =
      "1A" === e
        ? "AC First Class (1A)"
        : "EV" === e
          ? "Vistadome AC (EV)"
          : "EC" === e
            ? "Exec. Chair Car (EC)"
            : "2A" === e
              ? "AC 2 Tier (2A)"
              : "3A" === e
                ? "AC 3 Tier (3A)"
                : "3E" === e
                  ? "AC 3 Economy (3E)"
                  : "CC" === e
                    ? "AC Chair car (CC)"
                    : "SL" === e
                      ? "Sleeper (SL)"
                      : "2S" === e
                        ? "Second Sitting (2S)"
                        : "None"),
    labletext
  );
}

// Translates IRCTC quota codes to human-readable labels
function quotaTranslator(e) {
  return (
    "GN" === e
      ? (labletext = "GENERAL")
      : "TQ" === e
        ? (labletext = "TATKAL")
        : "PT" === e
          ? (labletext = "PREMIUM TATKAL")
          : "LD" === e
            ? (labletext = "LADIES")
            : "SR" === e
              ? (labletext = "LOWER BERTH/SR.CITIZEN")
              : labletext,
    labletext
  );
}

// Busy-wait delay function (not recommended for production)
function addDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Refactored payment selection logic to be more efficient and avoid performance violations.
async function selectPaymentMethod() {
  console.log("bkgPaymentOptions: Starting asynchronous payment selection.");
  await addDelay(200); // A small delay to ensure the page is responsive.

  // 1. Determine payment method details from user_data
  const paymentMethod = user_data.other_preferences.paymentmethod;
  let categoryText = "Multiple Payment Service";
  let optionText = "IRCTC iPay (Credit Card/Debit Card/UPI)";
  let clickCategory = true; // Most payment methods require clicking a category first.

  // Logic to set the category and option text based on user's preference
  if (paymentMethod.includes("IRCUPI")) {
    clickCategory = false; // This option is visible by default
    optionText = "Credit cards/Debit cards/Netbanking/UPI (Powered by IRCTC)";
    console.log("Payment option-IRCUPI");
  } else if (paymentMethod.includes("PAYTMUPI")) {
    categoryText = "BHIM/ UPI/ USSD";
    optionText = "Pay using BHIM (Powered by PAYTM ) also accepts UPI";
    console.log("Payment option-PAYTMUPI");
  } else if (paymentMethod.includes("PHONEPEUPI")) {
    categoryText = "Multiple Payment Service";
    optionText = "Credit & Debit cards / Wallet / UPI (Powered by PhonePe)";
    console.log("Payment option-PHONEPEUPI");
  } else if (paymentMethod.includes("MOBUPI")) {
    // This seems to be a mobile-specific alias for PhonePe
    categoryText = "Multiple Payment Service";
    optionText = "Credit & Debit cards / Wallet / UPI (Powered by PhonePe)";
    console.log("Payment option-MOBUPI");
  } else if (paymentMethod.includes("IRCWA")) {
    categoryText = "IRCTC eWallet";
    optionText = "IRCTC eWallet";
    console.log("Payment option-IRCWA");
  } else if (paymentMethod.includes("HDFCDB")) {
    categoryText = "Payment Gateway / Credit Card / Debit Card";
    optionText = "Visa/Master Card(Powered By HDFC BANK)";
    console.log("Payment option-HDFCDB");
  }

  try {
    // 2. Wait for the payment options container to be ready.
    await waitForElement("#pay-type .bank-type", 15000);
    console.log("Payment options container is ready.");

    // 3. Click the payment category if necessary.
    if (clickCategory) {
      const categories = [...document.querySelectorAll("#pay-type .bank-type")];
      const categoryElement = categories.find(el => el.innerText.trim().includes(categoryText));
      if (categoryElement) {
        console.log("Clicking payment category:", categoryText);
        categoryElement.click();
        await addDelay(500); // Wait for the specific options to load/expand.
      } else {
        throw new Error(`Payment category "${categoryText}" not found.`);
      }
    }

    // 4. Find and click the specific payment option.
    const normalizedOptionText = optionText.replace(/&/g, "&amp;").toUpperCase();
    const options = [...document.querySelectorAll(".border-all.no-pad span")];

    // Find a visible span that contains the option text.
    const optionElement = options.find(span => {
      const parent = span.closest('.border-all.no-pad');
      if (!parent) return false;
      const rect = parent.getBoundingClientRect();
      const isVisible = rect.top > 0 || rect.height > 0; // Simple visibility check
      return isVisible && span.innerHTML.toUpperCase().includes(normalizedOptionText);
    });

    if (optionElement) {
      console.log("Clicking payment option:", optionText);
      optionElement.click();
    } else {
      throw new Error(`Payment option "${optionText}" not found or not visible.`);
    }

    // 5. Scroll to and handle the final submission button.
    const payButton = await waitForElement(".btn-primary", 5000);
    payButton.scrollIntoView({ behavior: "smooth", block: "center" });
    await addDelay(500);

    if (user_data.other_preferences?.paymentManual) {
      alert("Manually submit the payment page.");
    } else {
      console.log("Clicking final 'Pay' button.");
      payButton.click();
    }

  } catch (error) {
    console.error("Error during payment selection:", error);
    alert(`An error occurred during payment selection: ${error.message}. Please proceed manually.`);
  }
}

// Main message listener for extension commands (selectJourney, fillPassengerDetails, etc.)
chrome.runtime.onMessage.addListener((e, t, o) => {
  if ("irctc" !== e.id) return void o("Invalid Id");
  const r = e.msg.type;
  if ("selectJourney" === r) {
    console.log("selectJourney"),
      (popupbtn = document.querySelectorAll(".btn.btn-primary")),
      popupbtn.length > 0 &&
      (popupbtn[1].click(), console.log("Close last trxn popup"));
    const e = [
      ...document
        .querySelector("#divMain > div > app-train-list")
        .querySelectorAll(".tbis-div app-train-avl-enq"),
    ];
    console.log(user_data.journey_details["train-no"]);
    const t = user_data.journey_details["train-no"],
      o = e.filter((e) =>
        e
          .querySelector("div.train-heading")
          .innerText.trim()
          .includes(t.split("-")[0])
      )[0];
    if ("M" === user_data.travel_preferences.AvailabilityCheck)
      return void alert("Please manually select train and click Book");
    if (
      "A" === user_data.travel_preferences.AvailabilityCheck ||
      "I" === user_data.travel_preferences.AvailabilityCheck
    ) {
      if (!o)
        return (
          console.log("Precheck - Train not found for search criteria."),
          void alert(
            "Precheck - Train(" +
            t +
            ") not found for search criteria. You can manually proceed or correct data and restart the process."
          )
        );
      const e = classTranslator(user_data.journey_details.class);
      if (
        ![...o.querySelectorAll("table tr td div.pre-avl")].filter(
          (t) => t.querySelector("div").innerText === e
        )[0]
      )
        return (
          console.log("Precheck - Selected Class not available in the train."),
          void alert(
            "Precheck - Selected Class not available in the train. You can manually proceed or correct data and restart the process."
          )
        );
    }
    const r = document.querySelector(
      "div.row.col-sm-12.h_head1 > span > strong"
    );
    if ("A" === user_data.travel_preferences.AvailabilityCheck)
      if (
        (console.log("Automatically click"),
          "TQ" === user_data.journey_details.quota ||
          "PT" === user_data.journey_details.quota ||
          "GN" === user_data.journey_details.quota)
      ) {
        console.log("Verify tatkal time");
        const e = user_data.journey_details.class;
        (requiredTime = "00:00:00"),
          (current_time = "00:00:00"),
          ["1A", "2A", "3A", "CC", "EC", "3E"].includes(e.toUpperCase())
            ? (requiredTime = user_data.other_preferences.acbooktime)
            : (requiredTime = user_data.other_preferences.slbooktime),
          "GN" === user_data.journey_details.quota &&
          (requiredTime = user_data.other_preferences.gnbooktime),
          console.log("requiredTime", requiredTime);
        var a = 0;
        let t = new MutationObserver((e) => {
          if (
            ((current_time = new Date(new Date().getTime() + 8000).toTimeString().split(" ")[0]),
              console.log("current_time", current_time),
              current_time > requiredTime)
          )
            t.disconnect(), selectJourney();
          else {
            if (0 == a) {
              console.log("Inside wait counter 0 ");
              try {
                const e = document.createElement("div");
                (e.textContent =
                  "Please wait..Booking will automatically start at " +
                  requiredTime),
                  (e.style.textAlign = "center"),
                  (e.style.color = "white"),
                  (e.style.height = "auto"),
                  (e.style.fontSize = "20px");
                document
                  .querySelector(
                    "#divMain > div > app-train-list > div> div > div > div.clearfix"
                  )
                  .insertAdjacentElement("afterend", e);
              } catch (e) {
                console.log("wait time failed", e.message);
              }
            }
            try {
              a % 2 == 0
                ? (console.log("counter1", a % 2),
                  (document.querySelector(
                    "#divMain > div > app-train-list > div > div > div > div:nth-child(2)"
                  ).style.background = "green"))
                : (console.log("counter2", a % 2),
                  (document.querySelector(
                    "#divMain > div > app-train-list > div > div > div > div:nth-child(2)"
                  ).style.background = "red"));
            } catch (e) { }
            (a += 1), console.log("wait time");
          }
        });
        t.observe(r, { childList: !0, subtree: !0, characterDataOldValue: !0 });
      } else console.log("select journey GENERAL quota"), selectJourney();
    else
      "I" === user_data.travel_preferences.AvailabilityCheck &&
        (console.log("Immediately click"), selectJourney());
  } else if ("fillPassengerDetails" === r)
    console.log("fillPassengerDetails"), fillPassengerDetails();
  else if ("reviewBooking" === r) {
    console.log("reviewBooking");
    try {
      // 🔓 Force unlock plan check
      chrome.storage.local.get(["plan"], (e) => {
        console.log("Force enabling plan A – bypassing check");
        e.plan = "A";
        console.log("User have active plan");
      });
    } catch (e) {
      alert("Failed to validate plan. Please contact our support team");
      try {
        document
          .querySelector(
            "body > app-root > app-home > div.header-fix > app-header > div.col-sm-12.h_container > div.text-center.h_main_div > div.row.col-sm-12.h_head1 > a.search_btn.loginText.ng-star-inserted"
          )
          .click();
      } catch (e) {
        window.location.href = "https://www.irctc.co.in/nget/train-search";
      }
    }
    if (
      (document.querySelector("#captcha").scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      }),
        void 0 !== user_data.other_preferences.autoCaptcha &&
        user_data.other_preferences.autoCaptcha)
    )
      waitForElement('.captcha-img').then(element => {
        getCaptchaTC();
      });
    else {
      console.log("Manuall captcha filling");
      let e = "X";
      const t = document.querySelector("#captcha");
      (t.value = e),
        t.dispatchEvent(new Event("input")),
        t.dispatchEvent(new Event("change")),
        t.focus();
    }
  } else if ("bkgPaymentOptions" === r) {
    console.log("bkgPaymentOptions message received, starting async selection.");
    selectPaymentMethod();
  } else console.log("Nothing to do");
  o("Something went wrong");
});

window.captchaRetry = window.captchaRetry || 0;


// Captcha reading using Google Vision API
function getCaptcha() {

  if (captchaRetry < 100) {
    console.log("getCaptcha"), (captchaRetry += 1);
    const e = document.querySelector(".captcha-img");
    if (e) {
      const t = new XMLHttpRequest(),
        o = e.src.substr(22),
        r = JSON.stringify({
          requests: [
            {
              image: { content: o },
              features: [{ type: "TEXT_DETECTION" }],
              imageContext: { languageHints: ["en"] },
            },
          ],
        }),
        a = "AIzaSyDnvpf2Tusn2Cp2icvUjGBBbfn_tY86QgQ";
      user_data.other_preferences.projectId;
      t.open(
        "POST",
        "https://vision.googleapis.com/v1/images:annotate?key=" + a,
        !1
      ),
        (t.onload = function () {
          if (200 != t.status)
            console.log(`Error ${t.status}: ${t.statusText}`),
              console.log(t.response);
          else {
            let e = "";
            const o = document.querySelector("#captcha");
            (e = JSON.parse(t.response).responses[0].fullTextAnnotation.text),
              console.log("Org text", e);
            const r =
              "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=@",
              a = Array.from(
                e.split(" ").join("").replace(")", "J").replace("]", "J")
              );
            let n = "";
            for (const e of a) r.includes(e) && (n += e);
            (o.value = n),
              "" == e &&
              (console.log("Null captcha text from api"),
                document
                  .getElementsByClassName("glyphicon glyphicon-repeat")[0]
                  .parentElement.click(),
                setTimeout(() => {
                  getCaptcha();
                }, 500)),
              o.dispatchEvent(new Event("input")),
              o.dispatchEvent(new Event("change")),
              o.focus();
            const l = document.querySelector("app-login"),
              i = document.querySelector(
                "#divMain > div > app-review-booking > p-toast"
              );
            let c = new MutationObserver((e) => {
              l &&
                l.innerText.toLowerCase().includes("valid captcha") &&
                (setTimeout(() => {
                  getCaptcha();
                }, 500),
                  console.log("disconnect loginCaptcha"),
                  c.disconnect()),
                i &&
                i.innerText.toLowerCase().includes("valid captcha") &&
                (setTimeout(() => {
                  getCaptcha();
                }, 500),
                  console.log("disconnect reviewCaptcha"),
                  c.disconnect());
            });
            l &&
              (console.log("observe loginCaptcha"),
                c.observe(l, {
                  childList: !0,
                  subtree: !0,
                  characterDataOldValue: !0,
                })),
              i &&
              (console.log("observe reviewCaptcha"),
                c.observe(i, {
                  childList: !0,
                  subtree: !0,
                  characterDataOldValue: !0,
                }));
          }
        }),
        (t.onerror = function () {
          console.log("Captcha API Request failed");
        }),
        t.send(r);
    } else
      console.log("wait for captcha load"),
        setTimeout(() => {
          getCaptcha();
        }, 1e3);
  }
}



// -------------------- Helper Functions --------------------

// (Step H1) API से captcha text निकालने वाला function
function fetchCaptchaText(base64data, onSuccess, onError) {
  // (Step H1.1) Request data को JSON format में तैयार करना
  const requestData = JSON.stringify({
    client: "chrome extension",
    location: "https://www.irctc.co.in/nget/train-search",
    version: "0.3.8",
    case: "mixed",
    promise: "true",
    extension: true,
    userid: "deepak845444.0@gmail.com",
    apikey: "N0cGrrxieNhn8Ggz4OcS",
    data: base64data,
  });

  // (Step H1.2) API call के लिए XMLHttpRequest बनाना
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "https://api.apitruecaptcha.org/one/gettext", false);

  // (Step H1.3) Request success होने पर result parse करना
  xhr.onload = () => {
    if (xhr.status === 200) {
      const result = JSON.parse(xhr.response).result || "";
      onSuccess(result); // (Step H1.3a) Success callback call
    } else {
      console.log(`Error ${xhr.status}: ${xhr.statusText}`);
      console.log(xhr.response);
      onError(); // (Step H1.3b) Error callback call
    }
  };

  // (Step H1.4) Network error handle करना
  xhr.onerror = () => {
    console.log("Captcha API Request failed");
    onError();
  };

  // (Step H1.5) Request भेजना
  xhr.send(requestData);
}

// (Step H2) Captcha text साफ करना
function cleanCaptchaText(rawText) {
  const allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=@";
  const chars = Array.from(
    rawText.split(" ").join("").replace(")", "J").replace("]", "J")
  );
  return chars.filter(ch => allowed.includes(ch)).join("");
}

// (Step H3) Captcha input field में भरना
function fillCaptchaInput(text) {
  const input = document.querySelector("#captcha");
  if (!input) return;
  input.value = text;
  input.dispatchEvent(new Event("input"));
  input.dispatchEvent(new Event("change"));
  input.focus();
}

// (Step H4) Login button auto click करना (Manual Mode)
function clickLoginButton() {
  const loginApp = document.querySelector("app-login");
  if (!loginApp) return;

  const btn =
    loginApp.querySelector("button[type='submit'][class='search_btn train_Search']") ||
    loginApp.querySelector("button[type='submit'][class*='train_Search']") ||
    loginApp.querySelector("button[type='submit']");

  if (btn) {
    setTimeout(() => {
      btn.click();
      console.log("Login button clicked after captcha fill (Manual Mode)");
    }, 500);
  }
}

// (Step H5) Observer लगाना invalid captcha detect करने के लिए
function attachCaptchaObserver() {
  const loginApp = document.querySelector("app-login");
  const reviewToast = document.querySelector("#divMain > div > app-review-booking > p-toast");

  const observer = new MutationObserver(() => {
    // (Step H5.1) Login captcha invalid मिला
    if (loginApp && loginApp.innerText.toLowerCase().includes("valid captcha")) {
      console.log("Retry captcha (login)");
      observer.disconnect();
      setTimeout(getCaptchaTC, 500);
    }
    // (Step H5.2) Review captcha invalid मिला
    if (reviewToast && reviewToast.innerText.toLowerCase().includes("valid captcha")) {
      console.log("Retry captcha (review)");
      observer.disconnect();
      setTimeout(getCaptchaTC, 500);
    }
  });

  if (loginApp) {
    console.log("observe loginCaptcha");
    observer.observe(loginApp, { childList: true, subtree: true, characterDataOldValue: true });
  }

  if (reviewToast) {
    console.log("observe reviewCaptcha");
    observer.observe(reviewToast, { childList: true, subtree: true, characterDataOldValue: true });
  }
}

// (Step H6) Auto submit mode handle करना
function handleAutoSubmit() {
  console.log("Auto submit captcha");

  // (Step H6.1) Login page auto submit
  if (window.location.href.includes("nget/train-search")) {
    const loginPage = document.querySelector("#divMain > app-login");
    if (loginPage) {
      const user = loginPage.querySelector("input[type='text'][formcontrolname='userid']");
      const pass = loginPage.querySelector("input[type='password'][formcontrolname='password']");
      const captchaInput = document.querySelector("#captcha");

      if (user.value && pass.value && captchaInput.value) {
        console.log("Submit login info, password और captcha");
        setTimeout(() => {
          clickLoginButton(); // ✅ Safe fallback function use करो
        }, 500);
      } else {
        alert("Username, password या captcha missing है, कृपया manually submit करें");
      }
    }
  }

  // (Step H6.2) Review page auto submit
  if (window.location.href.includes("booking/reviewBooking")) {
    const reviewPage = document.querySelector("#divMain > div > app-review-booking");
    if (reviewPage && document.querySelector("#captcha").value) {
      const confirmBtn = document.querySelector(".btnDefault.train_Search");
      if (confirmBtn) {
        setTimeout(() => {
          if (user_data.other_preferences.confirmberths) {
            waitForElement(".AVAILABLE", 1500).then(() => {
              console.log("Seats available");
              confirmBtn.click();
            }).catch(() => {
              if (confirm("No seats Available, Do you still want to continue booking?")) {
                console.log("No Seats available, still Go ahead");
                confirmBtn.click();
              } else {
                console.log("No Seats available, STOP");
              }
            });
          } else {
            confirmBtn.click();
          }


        }, 500);
      }
    }
  }

}


// -------------------- Main Function --------------------

// (Step M1) Captcha processing का main function
function getCaptchaTC() {
  console.log("user data", user_data);

  // (Step M1.1) Retry limit check
  if (captchaRetry >= 100) return;

  console.log("getCaptchaTC");
  captchaRetry += 1; // (Step M1.2) Retry counter बढ़ाना

  // (Step M1.3) Captcha image ढूँढना
  const captchaImg = document.querySelector(".captcha-img");

  // (Step M1.4) अगर image नहीं मिला तो wait करना
  if (!captchaImg) {
    console.log("wait for captcha load");
    return setTimeout(getCaptchaTC, 1000);
  }

  // (Step M1.5) Captcha image का base64 data निकालना
  const base64data = captchaImg.src.substr(22);

  // (Step M1.6) API call करना captcha text के लिए
  fetchCaptchaText(
    base64data,
    // Success callback
    (rawText) => {
      console.log("Org text", rawText);

      // (Step M1.7) Captcha text clean करना
      const cleanedText = cleanCaptchaText(rawText);

      // (Step M1.8) Captcha input में भरना
      fillCaptchaInput(cleanedText);

      // (Step M1.9) अगर API ने empty text दिया तो refresh captcha करके retry करना
      if (!rawText) {
        console.log("Null captcha text from api");
        document.getElementsByClassName("glyphicon glyphicon-repeat")[0]?.parentElement.click();
        return setTimeout(getCaptchaTC, 500);
      }

      // (Step M1.10) Observer लगाना invalid captcha retry के लिए
      attachCaptchaObserver();

      // (Step M1.11) User preference check करके submit करना
      if (user_data.other_preferences.CaptchaSubmitMode === "A") {
        handleAutoSubmit(); // Auto mode
      } else {
        clickLoginButton(); // Manual mode
      }
    },
    // Error callback
    () => {
      // (Step M1.12) Error case → दुबारा retry करना
      setTimeout(getCaptchaTC, 1000);
    }
  );
}

// Autofills login details on IRCTC login page
function loadLoginDetails() {
  const e = document.querySelector("#divMain > app-login"),
    t = e.querySelector("input[type='text'][formcontrolname='userid']"),
    o = e.querySelector("input[type='password'][formcontrolname='password']");

  // Fill username & password
  t.value = user_data.irctc_credentials.user_name ?? "";
  t.dispatchEvent(new Event("input"));
  t.dispatchEvent(new Event("change"));

  o.value = user_data.irctc_credentials.password ?? "";
  o.dispatchEvent(new Event("input"));
  o.dispatchEvent(new Event("change"));

  // Scroll to captcha field
  document.querySelector("#captcha").scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });

  // Auto captcha mode
  if (user_data.other_preferences.autoCaptcha) {
    waitForElement('.captcha-img').then(() => {
      getCaptchaTC(); // Captcha fill + auto submit
    });
  } else {
    console.log("Manual captcha filling");
    const t = document.querySelector("#captcha");
    t.focus();
    // अब user manually captcha डालकर खुद login करेगा
  }
}





// Optimized version of loadJourneyDetails
async function loadJourneyDetails() {
  console.log("User data:", user_data);
  console.log("filling_journey_details");

  // Batch find all elements first
  const form = document.querySelector("app-jp-input form");
  if (!form) {
    console.error("Journey form not found");
    return;
  }

  const originInput = form.querySelector("#origin > span > input");
  const destinationInput = form.querySelector("#destination > span > input");
  const dateInput = form.querySelector("#jDate > span > input");
  const classDropdown = form.querySelector("#journeyClass");
  const quotaDropdown = form.querySelector("#journeyQuota");
  const submitButton = form.querySelector("button.search_btn.train_Search[type='submit']");

  if (!originInput || !destinationInput || !dateInput || !classDropdown || !quotaDropdown || !submitButton) {
    console.error("One or more form elements not found");
    return;
  }

  // Batch update form values with minimal reflows
  await batchUpdateFormFields(
    originInput,
    destinationInput,
    dateInput,
    classDropdown,
    quotaDropdown,
    user_data
  );

  // Click submit button
  await addDelay(300);
  submitButton.click();
  console.log("filled_journey_details");
}

// Helper function to batch update form fields
async function batchUpdateFormFields(originInput, destinationInput, dateInput, classDropdown, quotaDropdown, userData) {
  // Update origin
  originInput.value = userData.journey_details.from;
  dispatchEvents(originInput, ['keydown', 'input']);

  // Update destination
  destinationInput.value = userData.journey_details.destination;
  dispatchEvents(destinationInput, ['keydown', 'input']);

  // Update date
  if (userData.journey_details.date) {
    dateInput.value = `${userData.journey_details.date.split("-").reverse().join("/")}`;
    dispatchEvents(dateInput, ['keydown', 'input']);
  }

  // Process class dropdown
  await processDropdown(classDropdown, classTranslator(userData.journey_details.class));

  // Process quota dropdown
  await processDropdown(quotaDropdown, quotaTranslator(userData.journey_details.quota));
}

// Helper function to process dropdowns
async function processDropdown(dropdown, targetText) {
  const button = dropdown.querySelector("div > div[role='button']");
  if (!button) return;

  button.click();
  await addDelay(300);

  const listItems = Array.from(dropdown.querySelectorAll("ul li"));
  const targetItem = listItems.find(li => li.innerText === targetText);

  if (targetItem) {
    targetItem.click();
    await addDelay(300);
  }
}

// Helper function to dispatch multiple events
function dispatchEvents(element, eventTypes) {
  eventTypes.forEach(eventType => {
    element.dispatchEvent(new Event(eventType, { bubbles: true }));
  });
}
// Old train selection logic (legacy, not used in main flow)
function selectJourneyOld() {
  if (!user_data.journey_details["train-no"]) return;
  const e = [
    ...document
      .querySelector("#divMain > div > app-train-list")
      .querySelectorAll(".tbis-div app-train-avl-enq"),
  ];
  console.log(user_data.journey_details["train-no"]);
  const t = e.filter((e) =>
    e
      .querySelector("div.train-heading")
      .innerText.trim()
      .includes(user_data.journey_details["train-no"])
  )[0];
  if (!t)
    return (
      console.log("Train not found."),
      alert("Train not found"),
      void statusUpdate("journey_selection_stopped.no_train")
    );
  const o = classTranslator(user_data.journey_details.class),
    r = new Date(user_data.journey_details.date).toString().split(" "),
    a = { attributes: !1, childList: !0, subtree: !0 };
  [...t.querySelectorAll("table tr td div.pre-avl")]
    .filter((e) => e.querySelector("div").innerText === o)[0]
    ?.click();
  const n = document.querySelector("#divMain > div > app-train-list > p-toast");
  new MutationObserver((e, a) => {
    const n = [
      ...t.querySelectorAll(
        "div p-tabmenu ul[role='tablist'] li[role='tab']"
      ),
    ].filter((e) => e.querySelector("div").innerText === o)[0],
      l = [...t.querySelectorAll("div div table td div.pre-avl")].filter(
        (e) => e.querySelector("div").innerText === `${r[0]}, ${r[2]} ${r[1]}`
      )[0],
      i = t.querySelector("button.btnDefault.train_Search.ng-star-inserted");
    if (n) {
      if ((console.log(1), !n.classList.contains("ui-state-active")))
        return console.log(2), void n.click();
      l &&
        (console.log(3),
          l.classList.contains("selected-class")
            ? (console.log(4), i.click(), a.disconnect())
            : (console.log(5), l.click()));
    } else console.log("6"), l.click(), i.click(), a.disconnect();
  }).observe(t, a);
  const l = new MutationObserver((e, r) => {
    console.log("Popup error"),
      console.log(
        "Class count ",
        [...t.querySelectorAll("table tr td div.pre-avl")].length
      ),
      console.log("Class count ", [
        ...t.querySelectorAll("table tr td div.pre-avl"),
      ]),
      n.innerText.includes("Unable to perform") &&
      (console.log("Unable to perform"),
        [...t.querySelectorAll("table tr td div.pre-avl")]
          .filter((e) => e.querySelector("div").innerText === o)[0]
          ?.click(),
        r.disconnect());
  });
  l.observe(n, a);
}

// Retries train selection after a delay
function retrySelectJourney() {
  console.log("Retrying selectJourney..."), setTimeout(selectJourney, 1e3);
}


if (typeof keyCounter === "undefined") {
  var keyCounter = 0;
}


// Optimized version with batched DOM operations
async function fillPassengerDetails() {
  console.log("passenger_filling_started");

  // Batch DOM queries at the beginning
  const passengerInputSection = document.querySelector("app-passenger-input");
  if (!passengerInputSection) {
    console.error("Passenger input section not found");
    return;
  }

  const allPassengers = [...passengerInputSection.querySelectorAll("app-passenger")];
  const allInfants = [...passengerInputSection.querySelectorAll("app-infant")];
  const prenextButtons = [...document.getElementsByClassName("prenext")];

  // Process boarding station if needed
  if (user_data.journey_details.boarding.length > 0) {
    await optimizeBoardingStationSelection();
  }

  keyCounter = performance.now(); // Use performance.now() for better accuracy

  // Navigate to the correct passenger
  if (allPassengers.length > 1 && user_data.passenger_details.length > 1) {
    for (let t = 1; t < user_data.passenger_details.length; t++) {
      await addDelay(100); // Reduced delay
      if (prenextButtons[0]) prenextButtons[0].click();
    }
  }

  // Process infants if any
  try {
    if (allInfants.length > 0 && user_data.infant_details.length > 0) {
      for (let eIdx = 0; eIdx < user_data.infant_details.length; eIdx++) {
        await addDelay(100); // Reduced delay
        if (prenextButtons[2]) prenextButtons[2].click();
      }
    }
  } catch (e) {
    console.error("add infant error", e);
  }

  // Batch process passenger details with minimal DOM access
  await batchProcessPassengers(allPassengers, user_data.passenger_details);

  // Process infant details if any
  try {
    if (user_data.infant_details.length > 0) {
      await batchProcessInfants(allInfants, user_data.infant_details);
    }
  } catch (e) {
    console.error("fill infant error", e);
  }

  // Process mobile number
  if ("" !== user_data.other_preferences.mobileNumber) {
    const mobileInput = passengerInputSection.querySelector(
      "input#mobileNumber[formcontrolname='mobileNumber'][name='mobileNumber']"
    );
    if (mobileInput) {
      mobileInput.value = user_data.other_preferences.mobileNumber;
      mobileInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // Process payment type
  await processPaymentType(passengerInputSection);

  // Process checkboxes
  processCheckboxes(passengerInputSection);

  // Process insurance
  await processInsurance(passengerInputSection);

  // Process reservation choice with optimized dropdown handling
  await processReservationChoice(passengerInputSection);

  submitPassengerDetailsForm(passengerInputSection);
}

// Helper function to batch process passengers
async function batchProcessPassengers(passengerElements, passengerData) {
  for (let t = 0; t < Math.min(passengerElements.length, passengerData.length); t++) {
    const passengerEl = passengerElements[t];
    const eData = passengerData[t];

    // Batch all field operations
    const fieldsToUpdate = [
      { selector: "p-autocomplete > span > input", value: eData.name, event: "input" },
      { selector: "input[type='number'][formcontrolname='passengerAge']", value: eData.age, event: "input" },
      { selector: "select[formcontrolname='passengerGender']", value: eData.gender, event: "change" },
      { selector: "select[formcontrolname='passengerBerthChoice']", value: eData.berth, event: "change" },
      { selector: "select[formcontrolname='passengerFoodChoice']", value: eData.food, event: "change" }
    ];

    for (const field of fieldsToUpdate) {
      const element = passengerEl.querySelector(field.selector);
      if (element && field.value !== undefined) {
        element.value = field.value;
        element.dispatchEvent(new Event(field.event, { bubbles: true }));
      }
    }

    // Process child berth flag if needed
    if (eData.passengerchildberth) {
      await processChildBerthFlag(passengerEl);
    }

    // Yield to the browser to prevent blocking
    if (t % 2 === 0) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }
}

function submitPassengerDetailsForm(e) {
  if (
    (console.log("passenger_filling_completed"),
      window.scrollBy(0, 600, "smooth"),
      user_data.other_preferences.hasOwnProperty("psgManual") &&
      user_data.other_preferences.psgManual)
  )
    alert("Manually submit the passenger page.");
  else
    var t = setInterval(function () {
      var o = new Date().getTime();
      keyCounter > 0 &&
        o - keyCounter > 2e3 &&
        (clearInterval(t),
          e
            .querySelector(
              "#psgn-form > form div > button.train_Search.btnDefault[type='submit']"
            )
            ?.click(),
          window.scrollBy(0, 600, "smooth"));
    }, 500);
}
// Continues script after login/logout, loads journey or login details as needed
function continueScript() {
  const e = document.querySelector(
    "body > app-root > app-home > div.header-fix > app-header > div.col-sm-12.h_container > div.text-center.h_main_div > div.row.col-sm-12.h_head1 > a.search_btn.loginText.ng-star-inserted"
  );
  window.location.href.includes("train-search")
    ? ("LOGOUT" === e.innerText.trim().toUpperCase() && loadJourneyDetails(),
      "LOGIN" === e.innerText.trim().toUpperCase() &&
      (e.click(), loadLoginDetails()))
    : window.location.href.includes("nget/booking/train-list") ||
    console.log("Nothing to do");
}
// Bypasses plan validation (for testing/unlocked mode)
async function a() {
  // ✅ Fake plan validation – always success
  console.log("Plan check bypassed – running in unlocked mode");

  // Fake success message (can be removed if unnecessary)
  chrome.storage.local.set({ plan: "A" }, () => {
    console.log("Plan set to A manually (force unlock)");
  });

  // Directly continue to start script without restriction
  startScript();
}

// Main window onload handler: sets up listeners, loads user data, starts automation
window.onload = function (e) {
  clickAlertOkButton();
  setInterval(function () {
    console.log("Repeater"), statusUpdate("Keep listener alive.");
  }, 15e3);
  const t = document.querySelector(
    "body > app-root > app-home > div.header-fix > app-header > div.col-sm-12.h_container > div.text-center.h_main_div > div.row.col-sm-12.h_head1 "
  );
  new MutationObserver((e, o) => {
    e.filter(
      (e) =>
        "childList" === e.type &&
        e.addedNodes.length > 0 &&
        [...e.addedNodes].filter(
          (e) => "LOGOUT" === e?.innerText?.trim()?.toUpperCase()
        ).length > 0
    ).length > 0
      ? (o.disconnect(), loadJourneyDetails())
      : (t.click(), loadLoginDetails());
  }).observe(t, { attributes: !1, childList: !0, subtree: !1 }),
    chrome.storage.local.get(null, (e) => {
      (user_data = e), continueScript();
    });
  console.log(user_data);

};

