const express = require('express');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use the stealth plugin to make Puppeteer act more like a human browser
puppeteerExtra.use(StealthPlugin());

const formUrl = 'https://a002-irm.nyc.gov/EventRegistration/RegForm.aspx?eventGuid=fa206f3d-6400-4a95-8b39-87b1bfa975ef';
const app = express();
const PORT = 8000;

app.use(express.json()); // to parse JSON request bodies

const fillForm = async ({ first, last, zip, reason }) => {
  try {
    const browser = await puppeteerExtra.launch({
      headless: false,
      devtools: true,
    });
    const page = await browser.newPage();

    // Set user agent to mimic a regular browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    await page.goto(formUrl, {
      waitUntil: 'networkidle2'
    });

    // Select "Brooklyn" option and trigger change event
    await page.evaluate(() => {
      const boroughSelector = Array.from(document.querySelectorAll('option')).find(e => e.value === 'Brooklyn').parentNode;
      boroughSelector.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const boroughIndex = Array.from(document.querySelectorAll('option')).findIndex(e => e.value === 'Brooklyn');
      boroughSelector.selectedIndex = boroughIndex;
      boroughSelector.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Wait for any network requests triggered by the first change
    await page.waitForNetworkIdle({ timeout: 5000 });

    // Select the option that contains "Rezoning" and trigger the change event
    await page.evaluate(() => {
      const rezoningOption = Array.from(document.querySelectorAll('option')).find(e => e.textContent.includes('Rezoning'));
      const rezoningSelector = rezoningOption.parentNode;
      rezoningSelector.scrollIntoView({ behavior: 'smooth', block: 'center' });
      rezoningSelector.value = rezoningOption.value;
      rezoningSelector.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Wait for any network requests triggered by the second change
    await page.waitForNetworkIdle({ timeout: 5000 });

    // Fill in the text fields with scrolling
    await page.evaluate(({ first, last, zip }) => {
      const fillInputByLabel = (labelText, value) => {
        const label = Array.from(document.querySelectorAll('label')).find(label => label.innerText.includes(labelText));
        if (label) {
          const inputId = label.getAttribute('for');
          const input = inputId ? document.getElementById(inputId) : label.nextElementSibling?.querySelector('input');
          if (input) {
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            input.value = value;
          }
        }
      };

      fillInputByLabel("First Name:", first);
      fillInputByLabel("Last Name:", last);
      fillInputByLabel("Zip Code:", zip);

      const myselfLabel = Array.from(document.querySelectorAll('label')).find(label => label.innerText.includes('Myself'));
      if (myselfLabel) {
        const checkboxId = myselfLabel.getAttribute('for');
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          checkbox.checked = true;
        }
      }

      const opposedLabel = Array.from(document.querySelectorAll('label')).find(label => label.innerText.includes('opposed'));
      if (opposedLabel) {
        const radioId = opposedLabel.getAttribute('for');
        const radioButton = document.getElementById(radioId);
        if (radioButton) {
          radioButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          radioButton.checked = true;
        }
      }

      // TODO: get this from POST body 
      const commentText = `Complete Lack of Community Engagement: This is a greedy move by Arrow Linen to massively profit from the facility they have owned for 40+ years, while operating off a 25-year tax abatement subsidized by city taxpayers. Arrow has spent thousands of dollars on lobbying elected officials, and did not spend any time or resources meeting with the community. Arrow stands to profit hundreds of millions of dollars from this application, and the community has had zero input on this transformational project. I ask the Commission listen to CB7’s findings and uphold DCP’s stated mission “Work with neighborhoods to develop sound ground-up frameworks for growth”.  I ask that you vote to disapprove this application so we can treat housing as a public good rather than a vehicle for massive profit.`;
      const textarea = document.getElementById('MainContent_datalistSections_datalistFields_3_Field_41844_4');
      if (textarea) {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        textarea.value = commentText;
      }
    }, { first, last, zip });

    // Add a 1-second delay before interacting with reCAPTCHA
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Interact with the reCAPTCHA checkbox by calculating its position
    // const recaptchaBox = await page.$('#recaptcha-anchor > div.recaptcha-checkbox-border');
    // const box = await recaptchaBox.boundingBox();
    // await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  } catch (error) {
    console.error(error);
  }
};

app.post('/fill', (req, res) => {
  const { first, last, zip } = req.body;
  fillForm({ first, last, zip })
})

// while in development, just call the method from here
fillForm({ first: 'John', last: 'Doe', zip: '11111' })

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
