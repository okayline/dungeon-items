-- Each typed 88x31 button's own flavour line (kura, Nov 5: "i'd like unique lines for all the cards"), from seed/flavor.json (sources there).
-- Run on items-db; running it again sets the same lines. It only touches extra.flavor (series, effect and the rest stay).
UPDATE items SET extra = json_set(extra, '$.flavor', 'This site is still under construction') WHERE id = 48 AND source = '88x31';   -- Under Construction
UPDATE items SET extra = json_set(extra, '$.flavor', 'I am carrying out a major upgrade on my homepage') WHERE id = 49 AND source = '88x31';   -- Made with Notepad
UPDATE items SET extra = json_set(extra, '$.flavor', 'Don''t worry, I''m pretty sure I''ve got everything on back-up in case something happens...') WHERE id = 62 AND source = '88x31';   -- Save Often
UPDATE items SET extra = json_set(extra, '$.flavor', 'Now you have a home page.') WHERE id = 67 AND source = '88x31';   -- HTML 4 Life
UPDATE items SET extra = json_set(extra, '$.flavor', 'I only sampled a bit of it but will return to view the rest when able.') WHERE id = 80 AND source = '88x31';   -- Firewall
UPDATE items SET extra = json_set(extra, '$.flavor', 'no time to scan it all but what I requested was interesting') WHERE id = 81 AND source = '88x31';   -- Virus Alert
UPDATE items SET extra = json_set(extra, '$.flavor', 'Some of these would look great on my home page.') WHERE id = 83 AND source = '88x31';   -- DOS Prompt
UPDATE items SET extra = json_set(extra, '$.flavor', '...come back next week when the other stuff''s been recovered...') WHERE id = 85 AND source = '88x31';   -- Blue Screen
UPDATE items SET extra = json_set(extra, '$.flavor', '-- This site under construction --') WHERE id = 91 AND source = '88x31';   -- root
UPDATE items SET extra = json_set(extra, '$.flavor', 'it''s very much under construction, as you might notice.') WHERE id = 92 AND source = '88x31';   -- Password Cracker
UPDATE items SET extra = json_set(extra, '$.flavor', 'Authentic old software in original unopened packaging.') WHERE id = 143 AND source = '88x31';   -- The Golden Floppy
UPDATE items SET extra = json_set(extra, '$.flavor', 'This page last updated on September 20, 1997') WHERE id = 144 AND source = '88x31';   -- 20 GOTO 20
UPDATE items SET extra = json_set(extra, '$.flavor', 'Be a friend, rewind when you reach the end') WHERE id = 172 AND source = '88x31';   -- Be Kind Rewind
UPDATE items SET extra = json_set(extra, '$.flavor', 'FOR MAXIMUM PICTURE QUALITY') WHERE id = 176 AND source = '88x31';   -- Tracking
UPDATE items SET extra = json_set(extra, '$.flavor', 'And there is the new, also-under-construction Picture Page') WHERE id = 189 AND source = '88x31';   -- Abort, Retry, Fail?
UPDATE items SET extra = json_set(extra, '$.flavor', 'the résumé page was updated some time in 1996.') WHERE id = 190 AND source = '88x31';   -- Ctrl+Alt+Del
UPDATE items SET extra = json_set(extra, '$.flavor', 'This Web Page is, as always, under construction.') WHERE id = 191 AND source = '88x31';   -- Format C:
UPDATE items SET extra = json_set(extra, '$.flavor', 'Other than that, this stuff is unchanged since November of 1994.') WHERE id = 199 AND source = '88x31';   -- Kernel Panic
UPDATE items SET extra = json_set(extra, '$.flavor', 'Worked every time.') WHERE id = 205 AND source = '88x31';   -- Blow on It
UPDATE items SET extra = json_set(extra, '$.flavor', 'Visitors since 8-30-97:') WHERE id = 53 AND source = '88x31';   -- Hit Counter
UPDATE items SET extra = json_set(extra, '$.flavor', 'NEW MILLENNIUM EDITION!') WHERE id = 61 AND source = '88x31';   -- Y2K Ready
UPDATE items SET extra = json_set(extra, '$.flavor', 'The CD-ROM gives you a lot of bang for the buck') WHERE id = 69 AND source = '88x31';   -- CD-ROM
UPDATE items SET extra = json_set(extra, '$.flavor', 'According to WebCounter, you are visitor number!') WHERE id = 76 AND source = '88x31';   -- 1,000,000th Visitor
UPDATE items SET extra = json_set(extra, '$.flavor', 'Large, expensive, ultra-fast computers.') WHERE id = 78 AND source = '88x31';   -- Mainframe
UPDATE items SET extra = json_set(extra, '$.flavor', 'Okay. That''s where the 2600-cycle tone comes in.') WHERE id = 82 AND source = '88x31';   -- 2600 Hz
UPDATE items SET extra = json_set(extra, '$.flavor', 'NO TRESPASSING') WHERE id = 86 AND source = '88x31';   -- Hex Dump
UPDATE items SET extra = json_set(extra, '$.flavor', 'Since Counter Reset 10/6/98') WHERE id = 87 AND source = '88x31';   -- Carrier Detect
UPDATE items SET extra = json_set(extra, '$.flavor', 'When pigs fly!') WHERE id = 93 AND source = '88x31';   -- Defrag
UPDATE items SET extra = json_set(extra, '$.flavor', 'This page has been accessed times since then') WHERE id = 95 AND source = '88x31';   -- Blinking 12:00
UPDATE items SET extra = json_set(extra, '$.flavor', 'Quad-speed and faster CD-ROM drives are now common.') WHERE id = 138 AND source = '88x31';   -- CD-ROM Rainbow
UPDATE items SET extra = json_set(extra, '$.flavor', '...or just hit your "back" button on your web browser.') WHERE id = 174 AND source = '88x31';   -- Fast Forward
UPDATE items SET extra = json_set(extra, '$.flavor', 'Wednesday. More reviews. Be here!') WHERE id = 192 AND source = '88x31';   -- Insert Disk 2
UPDATE items SET extra = json_set(extra, '$.flavor', 'No frames? Too bad! Continue at your own risk.') WHERE id = 198 AND source = '88x31';   -- Disk Full
UPDATE items SET extra = json_set(extra, '$.flavor', 'Solid Pac for a lifetime') WHERE id = 201 AND source = '88x31';   -- Insert Coin
UPDATE items SET extra = json_set(extra, '$.flavor', 'Everything started working.') WHERE id = 202 AND source = '88x31';   -- Turbo
UPDATE items SET extra = json_set(extra, '$.flavor', 'Have you played Atari today?') WHERE id = 206 AND source = '88x31';   -- Joystick
UPDATE items SET extra = json_set(extra, '$.flavor', 'best viewed with Netscape Navigator Gold 2.0+') WHERE id = 54 AND source = '88x31';   -- Best Viewed 800x600
UPDATE items SET extra = json_set(extra, '$.flavor', 'Aloha! Welcome to my home page!') WHERE id = 59 AND source = '88x31';   -- Island Life
UPDATE items SET extra = json_set(extra, '$.flavor', 'Remember to place a Paragraph mark before and after the image like this:') WHERE id = 107 AND source = '88x31';   -- Rainbow
UPDATE items SET extra = json_set(extra, '$.flavor', 'Sparkling lights of the city add to the beauty of this dramatic view.') WHERE id = 119 AND source = '88x31';   -- Island Life Moonlight
UPDATE items SET extra = json_set(extra, '$.flavor', 'It''s been counting for a couple of hundred days now... only nine to go...') WHERE id = 142 AND source = '88x31';   -- Millennium Fireworks
UPDATE items SET extra = json_set(extra, '$.flavor', 'Please sign my guest book.') WHERE id = 50 AND source = '88x31';   -- Sign My Guestbook
UPDATE items SET extra = json_set(extra, '$.flavor', 'E-mail me for comments about this page!!') WHERE id = 51 AND source = '88x31';   -- Email Me!!
UPDATE items SET extra = json_set(extra, '$.flavor', 'A Beauty of the South') WHERE id = 57 AND source = '88x31';   -- Four Kimono Ladies
UPDATE items SET extra = json_set(extra, '$.flavor', 'Thanks for signing my Guestbook. We''ll see on the net...') WHERE id = 65 AND source = '88x31';   -- New Mail!
UPDATE items SET extra = json_set(extra, '$.flavor', 'He was very easy to care for :)') WHERE id = 68 AND source = '88x31';   -- Virtual Pet
UPDATE items SET extra = json_set(extra, '$.flavor', ':-) Read it sideways.') WHERE id = 71 AND source = '88x31';   -- Have a Nice Day
UPDATE items SET extra = json_set(extra, '$.flavor', 'This site''s gone in the bookmarks :-)') WHERE id = 74 AND source = '88x31';   -- Ink Pen
UPDATE items SET extra = json_set(extra, '$.flavor', 'How did you find me? :') WHERE id = 88 AND source = '88x31';   -- BBS Online
UPDATE items SET extra = json_set(extra, '$.flavor', 'Where are you from?') WHERE id = 89 AND source = '88x31';   -- IRC
UPDATE items SET extra = json_set(extra, '$.flavor', 'glimmering gold-leaf surfaces') WHERE id = 114 AND source = '88x31';   -- Four Kimono Ladies Gold Leaf
UPDATE items SET extra = json_set(extra, '$.flavor', 'They look like winter''s last snow.') WHERE id = 115 AND source = '88x31';   -- Four Kimono Ladies Sakura
UPDATE items SET extra = json_set(extra, '$.flavor', 'Smile/Frown/Something Else?') WHERE id = 139 AND source = '88x31';   -- Have a Nice Day Gold
UPDATE items SET extra = json_set(extra, '$.flavor', 'I find myself hatching a new egg every 22 days or so.') WHERE id = 140 AND source = '88x31';   -- Virtual Pet Golden Egg
UPDATE items SET extra = json_set(extra, '$.flavor', 'mine are old sketches, "in progress" work, and never-finished work.') WHERE id = 180 AND source = '88x31';   -- Kimono Lady 1 (Prototype)
UPDATE items SET extra = json_set(extra, '$.flavor', 'The plans were scanned using a 72 dpi resolution, in order to save space.') WHERE id = 181 AND source = '88x31';   -- Kimono Lady 2 (Prototype)
UPDATE items SET extra = json_set(extra, '$.flavor', 'they will be universally honored between browsers') WHERE id = 182 AND source = '88x31';   -- Kimono Lady 3 (Prototype)
UPDATE items SET extra = json_set(extra, '$.flavor', 'Literally "one colour".') WHERE id = 183 AND source = '88x31';   -- Kimono Lady 4 (Prototype)
UPDATE items SET extra = json_set(extra, '$.flavor', 'New to internet, so you are first hit.') WHERE id = 193 AND source = '88x31';   -- Hello World
UPDATE items SET extra = json_set(extra, '$.flavor', 'This page allows you to sign my guestbook.') WHERE id = 195 AND source = '88x31';   -- Sysop Is In
UPDATE items SET extra = json_set(extra, '$.flavor', 'Glad you made it here') WHERE id = 197 AND source = '88x31';   -- Caps Lock
UPDATE items SET extra = json_set(extra, '$.flavor', 'By all means, experiment.') WHERE id = 204 AND source = '88x31';   -- Dot Matrix
UPDATE items SET extra = json_set(extra, '$.flavor', 'I have "Surfed the Net" for a year or so now') WHERE id = 47 AND source = '88x31';   -- Surf the Web
UPDATE items SET extra = json_set(extra, '$.flavor', 'You have to really have a site that ROCKS to win this one.') WHERE id = 55 AND source = '88x31';   -- Bodacious
UPDATE items SET extra = json_set(extra, '$.flavor', 'This award is hard to acquire.') WHERE id = 56 AND source = '88x31';   -- Radical!
UPDATE items SET extra = json_set(extra, '$.flavor', 'A very robot-like effect.') WHERE id = 58 AND source = '88x31';   -- Synthwave
UPDATE items SET extra = json_set(extra, '$.flavor', 'Start it out with a bang!') WHERE id = 60 AND source = '88x31';   -- Mix Tape
UPDATE items SET extra = json_set(extra, '$.flavor', 'The amorphous blob light was an immediate hit') WHERE id = 70 AND source = '88x31';   -- Lava Lamp
UPDATE items SET extra = json_set(extra, '$.flavor', 'This site is best heard with Liveupdate Crescendo..') WHERE id = 72 AND source = '88x31';   -- MIDI On
UPDATE items SET extra = json_set(extra, '$.flavor', 'Laurel''s Cool Page Award') WHERE id = 73 AND source = '88x31';   -- Cool Site!
UPDATE items SET extra = json_set(extra, '$.flavor', 'It''s my honour to win this award.') WHERE id = 94 AND source = '88x31';   -- 1337
UPDATE items SET extra = json_set(extra, '$.flavor', 'Record yourself between tracks.') WHERE id = 96 AND source = '88x31';   -- REC
UPDATE items SET extra = json_set(extra, '$.flavor', 'Use side A to build up') WHERE id = 97 AND source = '88x31';   -- Side A
UPDATE items SET extra = json_set(extra, '$.flavor', 'The Modern Miracle of Living Stereo') WHERE id = 98 AND source = '88x31';   -- Hi-Fi Stereo
UPDATE items SET extra = json_set(extra, '$.flavor', 'Enhanced For Your Viewing Pleasure') WHERE id = 99 AND source = '88x31';   -- Neon Nite
UPDATE items SET extra = json_set(extra, '$.flavor', 'Within an hour or so I had my lava lamp happily blurbing away.') WHERE id = 137 AND source = '88x31';   -- Lava Lamp Blacklight
UPDATE items SET extra = json_set(extra, '$.flavor', '7 weeks, 2 days, 8 hours, 15 minutes, 33.50 seconds') WHERE id = 145 AND source = '88x31';   -- FRAKTAL.PIC
UPDATE items SET extra = json_set(extra, '$.flavor', 'So how does this thing work?') WHERE id = 146 AND source = '88x31';   -- Fraktal
UPDATE items SET extra = json_set(extra, '$.flavor', 'his explorations in a seahorse valley of the Mset') WHERE id = 147 AND source = '88x31';   -- Seahorse Valley
UPDATE items SET extra = json_set(extra, '$.flavor', 'Here''s a region I call Bird Of Paridise.') WHERE id = 148 AND source = '88x31';   -- Elephant Valley
UPDATE items SET extra = json_set(extra, '$.flavor', 'a theme of very long twisted fingers') WHERE id = 149 AND source = '88x31';   -- Tendrils
UPDATE items SET extra = json_set(extra, '$.flavor', 'tiny little barely-visible spirals') WHERE id = 150 AND source = '88x31';   -- Spiral
UPDATE items SET extra = json_set(extra, '$.flavor', 'small M with period 1280. mag 10^1539.') WHERE id = 151 AND source = '88x31';   -- Mini-Fraktal
UPDATE items SET extra = json_set(extra, '$.flavor', 'If there were one ghetto blaster to obtain, this might be it.') WHERE id = 178 AND source = '88x31';   -- Boom Box
UPDATE items SET extra = json_set(extra, '$.flavor', 'has a different palette') WHERE id = 184 AND source = '88x31';   -- Fraktal Neon Test (Prototype)
UPDATE items SET extra = json_set(extra, '$.flavor', 'the boundary will never appear smooth irrespective of the zoom factors') WHERE id = 185 AND source = '88x31';   -- Fraktal Wireframe (Prototype)
UPDATE items SET extra = json_set(extra, '$.flavor', 'a 1024x768x256 image of 195 kbytes.') WHERE id = 186 AND source = '88x31';   -- Fraktal Low Res (Prototype)
UPDATE items SET extra = json_set(extra, '$.flavor', '?SYNTAX  ERROR IN 10') WHERE id = 187 AND source = '88x31';   -- ?SYNTAX ERROR (Prototype)
UPDATE items SET extra = json_set(extra, '$.flavor', 'all kinds of graphics for the homepage - free!!') WHERE id = 196 AND source = '88x31';   -- Shareware
UPDATE items SET extra = json_set(extra, '$.flavor', 'Welcome to my very own little world!') WHERE id = 203 AND source = '88x31';   -- Starfield
UPDATE items SET extra = json_set(extra, '$.flavor', 'A shifting display of colors.') WHERE id = 207 AND source = '88x31';   -- Plasma
UPDATE items SET extra = json_set(extra, '$.flavor', 'AS IS ALWAYS THE CASE WITH GREETZ!!') WHERE id = 208 AND source = '88x31';   -- Copper Bars
UPDATE items SET extra = json_set(extra, '$.flavor', 'The cornerstone of many demos') WHERE id = 209 AND source = '88x31';   -- Vector Cube
UPDATE items SET extra = json_set(extra, '$.flavor', 'A picture (bitmap) that rotates on the screen.') WHERE id = 210 AND source = '88x31';   -- Rotozoom
UPDATE items SET extra = json_set(extra, '$.flavor', 'This site is a member of WebRing.') WHERE id = 52 AND source = '88x31';   -- Webring Member
UPDATE items SET extra = json_set(extra, '$.flavor', 'If ET Calls, Will You be Listening?') WHERE id = 63 AND source = '88x31';   -- Aliens Welcome
UPDATE items SET extra = json_set(extra, '$.flavor', 'A good time was had by all') WHERE id = 64 AND source = '88x31';   -- Cyber Cafe
UPDATE items SET extra = json_set(extra, '$.flavor', 'fast, reliable Internet connections') WHERE id = 66 AND source = '88x31';   -- 56K Modem
UPDATE items SET extra = json_set(extra, '$.flavor', 'Home of the Pinoy Hams WebRing') WHERE id = 75 AND source = '88x31';   -- Webring Hub
UPDATE items SET extra = json_set(extra, '$.flavor', 'Go to the next site!') WHERE id = 77 AND source = '88x31';   -- Access Granted
UPDATE items SET extra = json_set(extra, '$.flavor', 'Go to the previous site!') WHERE id = 79 AND source = '88x31';   -- Cyberspace
UPDATE items SET extra = json_set(extra, '$.flavor', 'Join Today!') WHERE id = 84 AND source = '88x31';   -- Access Denied
UPDATE items SET extra = json_set(extra, '$.flavor', 'Want to join this ring?') WHERE id = 90 AND source = '88x31';   -- 127.0.0.1
UPDATE items SET extra = json_set(extra, '$.flavor', 'During HIGH speed dubbing, only the STOP button works.') WHERE id = 177 AND source = '88x31';   -- Hi-Speed Dubbing
UPDATE items SET extra = json_set(extra, '$.flavor', 'LOADING NEXT LEVEL') WHERE id = 179 AND source = '88x31';   -- Press Play on Tape
UPDATE items SET extra = json_set(extra, '$.flavor', 'Next 5 Sites') WHERE id = 194 AND source = '88x31';   -- Ping
UPDATE items SET extra = json_set(extra, '$.flavor', 'Join This Ring') WHERE id = 200 AND source = '88x31';   -- Telnet
UPDATE items SET extra = json_set(extra, '$.flavor', 'I have my SGI indy-cam trained on my workmate''s lava lamp') WHERE id = 221 AND source = '88x31';   -- Black Light Lava
UPDATE items SET extra = json_set(extra, '$.flavor', 'have a quish day') WHERE id = 222 AND source = '88x31';   -- Nice Day Coin
UPDATE items SET extra = json_set(extra, '$.flavor', 'I hatched my first Mimitchi on my lunch hour on September 1st.') WHERE id = 223 AND source = '88x31';   -- Virtual Pet Hatchling
UPDATE items SET extra = json_set(extra, '$.flavor', 'sling your blaster on a guitar strap') WHERE id = 224 AND source = '88x31';   -- Boomin' Nite
