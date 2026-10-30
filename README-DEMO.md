# VIFF - Demo build (hardcoded data, no server)
This folder is your real frontend (home page, about, admission, dashboards...) switched to hardcoded demo data.
Open index.html or login.html (Acode > Run, or any static server). Demo logins are on the login page:
admin@viffacademy.edu.ng / Admin@123 | super@viffacademy.edu.ng / Super@123 | teacher@viffacademy.edu.ng / Teacher@123 | parent@demo.com / Parent@123 | VIFF/2025/0001 / Student@123
Add ?reset to any page URL to restore the demo data. Do NOT deploy this folder as the live site.

2FA demo: open login.html?force2fa=1, sign in as Admin, and you are sent to the two-factor setup page (the authenticator is simulated: the code is always 123456).
After that every admin sign-in asks for the code. Open login.html?force2fa=0 to switch it off again.

Admission numbers demo: Admin > Student Management > Numbering (sign in as Super Admin to change it) and Import (use the template).
Students and parents created in the demo can sign in with the temporary password shown on the credentials screen.
