✧ How to Update the Trainee Roster in index.html (GitHub Pages) ✧


A. Via terminal / Cursor IDE (preferred if you already have the repo cloned)
Open a terminal tab inside Cursor in any folder you like.
Navigate to the repo and pull the latest copy
cd ~/code/orientation-feedback      # adjust path if different
git pull
Open the project in Cursor's editor
cursor .
Edit the roster array
Find the block near the top of index.html (or formA.html, whichever you kept):
const ORIENTEES = [
  "Jenny Nguyen",
  "Bob Smith",
  "Chris Patel"
];
Add, remove, or rename trainees.
Keep each name wrapped in straight quotes and end lines with a comma (except the last line).
Save (⌘S).
Commit and push
git add index.html            # or formA.html
git commit -m "Update roster for <Date or Class Name>"
git push
Wait ±30 seconds — GitHub Pages redeploys automatically.
Tell graders to hard-refresh the form link (Shift + ⌘ R or Ctrl + F5) if they still see the old list.

B. Directly in the GitHub web UI (no local tools required)
Go to the repo → click index.html.
Press the ✏️ Edit button.
Scroll to the ORIENTEES = [ … ] section and update the names.
At the bottom, under Commit changes:
Commit message → e.g. "Add July 22 cohort"
Choose Commit directly to main → Commit changes.
GitHub Pages redeploys automatically (30 s).
Share the same URL; add ?v=<today> at the end if anyone caches the old file.



https://collin-ho.github.io/orientation-feedback/formA.html

---

# How to Add a New Orientee to ClickUp via API

Set the variables once (or hard-code them):

```
TOKEN="pk_88230002_IATJEK33YPDB9F7C0CCZW1EYNE38GITL"
ORIENTEE_FIELD_ID="fdd1f582-d61c-47ac-920d-72a1f0107d7e"
```

⇢ Run this to add a new name and capture its UUID:

```
NEW_ID=$(curl -s -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"NEW_ORIENTEE_NAME"}' \
  "https://api.clickup.com/api/v2/field/$ORIENTEE_FIELD_ID/option" \
  | jq -r '.id')

echo "UUID for NEW_ORIENTEE_NAME → $NEW_ID"
```


list all the custom fields in this specfically 
curl -H "Authorization: <YOUR_CLICKUP_TOKEN>" \
  "https://api.clickup.com/api/v2/list/901409111922/field"

  