# Troubleshooting

Solutions to common issues with Lockdn. If you don't find your answer here, [open an issue on GitHub](https://github.com/lockdn/lockdn/issues).

---

## AI Features Not Working

### "AI features say 'No provider configured'"

**Solution:** Add an API key in Settings.

1. Go to **Settings** → **API Keys**
2. Select your provider (Anthropic, OpenAI, Google, or Ollama)
3. Enter your API key
4. Click **Save**

### "API key is rejected"

**Possible causes:**
- Key was copied incorrectly (check for extra spaces)
- Key has expired or been revoked
- Key doesn't have required permissions

**Solution:**
1. Get a fresh API key from your provider
2. Delete the old key in Lockdn
3. Add the new key

### "Tutor/extraction is very slow"

**Possible causes:**
- Large images or documents
- Network latency to AI provider
- API rate limits

**Solutions:**
- Wait for processing to complete
- Try with smaller files
- Check your API key hasn't hit rate limits

### "AI responses seem wrong or unhelpful"

**Solutions:**
- Provide more context in your questions
- Select the relevant course for context
- Rephrase your question
- Try a different AI provider

---

## Syllabus/Document Processing

### "Nothing was extracted from my syllabus"

**Possible causes:**
- File format not supported
- Image quality too low
- Unusual document structure

**Solutions:**
1. Try a different file format (PDF often works best)
2. If using images, ensure text is clearly visible
3. Try uploading individual pages

### "Extracted dates are wrong"

**This is common.** AI extraction is helpful but not perfect.

**Solution:**
1. Always review extracted items
2. Edit any incorrect dates before adding
3. Verify against your actual syllabus

### "Can't upload files"

**Possible causes:**
- Browser storage is full
- File is corrupted
- File is too large

**Solutions:**
- Clear browser cache and data
- Try a different file
- Reduce file size (compress images)
- Try a different browser

---

## Data and Storage

### "Data disappeared after closing browser"

**Possible causes:**
- Private/incognito browsing mode
- Browser cleared storage automatically
- Different browser or device

**Solutions:**
- Use regular browsing mode (not private/incognito)
- Check browser settings for auto-clearing data
- Make sure you're in the same browser

### "Browser says storage is full"

**Solutions:**
1. Archive old semesters (Settings → Data Management)
2. Delete notes you no longer need
3. Export important data, then clear old data
4. Check other sites using storage

### "Want to back up my data"

1. Go to **Settings** → **Data Management**
2. Click **Export All Data**
3. Save the file to your computer
4. Keep it somewhere safe

---

## Device Sync Issues

### "Devices won't pair"

**Solutions:**
1. Ensure both devices have internet access
2. Refresh Lockdn on both devices
3. Generate a new pairing code
4. Check that you're entering the code correctly
5. Try using the QR code instead

### "Sync stopped working"

**Possible causes:**
- Internet connection lost
- One device went to sleep
- Session timed out

**Solutions:**
1. Refresh Lockdn on both devices
2. Check internet connectivity
3. Devices should reconnect automatically

### "Data conflict or duplicates"

**Solutions:**
- Delete duplicate entries manually
- Make changes on one device at a time when possible
- Allow sync to complete before making more changes

### "API key didn't sync to my other device"

**This is by design.** API keys never sync for security reasons.

**Solution:**
Enter your API key separately on each device in Settings.

---

## Display and Interface Issues

### "Page is blank or won't load"

**Solutions:**
1. Refresh the page
2. Clear browser cache
3. Try a different browser
4. Check browser console for errors (F12)

### "Layout looks broken"

**Possible causes:**
- Browser zoom not at 100%
- Browser extensions interfering
- Outdated browser

**Solutions:**
1. Reset zoom to 100% (Ctrl/Cmd + 0)
2. Try with extensions disabled
3. Update your browser
4. Try a different browser

### "Dark mode not working"

1. Go to **Settings**
2. Find **Appearance**
3. Select your preferred theme
4. If set to "System," check your OS settings

---

## Calendar Issues

### "Events not showing on calendar"

**Solutions:**
1. Check filter settings (might be filtering courses)
2. Verify events have dates assigned
3. Navigate to the correct date range
4. Refresh the page

### "Can't add events to calendar"

**Solutions:**
1. Try clicking directly on a date
2. Add via Courses page instead
3. Refresh and try again

---

## Study Planning Issues

### "No study sessions generated"

**Possible causes:**
- No upcoming assignments with due dates
- No productivity hours set
- All assignments already completed

**Solutions:**
1. Add assignments with due dates
2. Set productivity hours in Settings
3. Check that assignments aren't all past-due

### "Study sessions at wrong times"

**Solutions:**
1. Update your productivity hours in Settings
2. Drag sessions to preferred times
3. Regenerate the study plan

---

## Performance Issues

### "Lockdn is running slowly"

**Solutions:**
1. Close other browser tabs
2. Clear browser cache
3. Archive old semester data
4. Use a faster browser (Chrome recommended)
5. Restart your browser

### "Images take forever to upload"

**Solutions:**
1. Resize images before uploading
2. Use JPG instead of PNG
3. Upload fewer images at once
4. Check internet connection speed

---

## Account and Access Issues

### "Lost access to my data"

**Remember:** Lockdn stores data in your browser. If you cleared browser data or switched browsers, data may be lost.

**Prevention:**
- Export data regularly
- Set up device sync as backup
- Don't clear browser storage

### "Data didn't transfer to new device"

**Solution:** Use Device Sync to transfer data.

1. Set up sync on your old device
2. Pair your new device
3. Wait for initial sync to complete

If the old device is unavailable, restore from an export file if you have one.

---

## Getting More Help

### Check GitHub Issues

Search existing issues: [github.com/lockdn/lockdn/issues](https://github.com/lockdn/lockdn/issues)

### Report a New Bug

Include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser and OS version
- Screenshots if helpful

### Request a Feature

Open a GitHub issue with:
- What you'd like Lockdn to do
- Why it would be helpful
- Any implementation ideas

---

## Emergency Recovery

### If All Else Fails

1. **Export your data** if possible (Settings → Data Management)
2. **Clear Lockdn data** in browser settings
3. **Reload Lockdn** fresh
4. **Import your data** from the export
5. **Reconfigure** settings and API keys

This resets Lockdn while preserving your content.
