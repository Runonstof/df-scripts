// ==UserScript==
// @name         Implant Image Replacer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Replace images of implants with custom images for easier recognition, custom made for TurboBongRips3
// @author       Runonstof
// @match        *fairview.deadfrontier.com/onlinezombiemmo/index.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deadfrontier.com
// @grant        unsafeWindow
// ==/UserScript==


(function() {
    'use strict';

    // Map of original image URLs to custom image URLs
    const imageMap = {
        // Use: https://base64.guru/converter/encode/image/webp
        // To convert to base 64 ^^, select the "Data URI -- data:content/type;base64" option!!

        // 'https://example.org/someimage.png': 'data:content/type;base64,base64stringhere==', // <--- DONT FORGET THE COMMAS
        'https://files.deadfrontier.com/deadfrontier/inventoryimages/large/elfimplant.png': 'data:image/webp;base64,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',
        'https://files.deadfrontier.com/deadfrontier/inventoryimages/large/sugarrushimplant.png': 'data:image/webp;base64,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',
        'https://files.deadfrontier.com/deadfrontier/inventoryimages/large/occulticeye.png': 'data:image/webp;base64,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',
        'https://files.deadfrontier.com/deadfrontier/inventoryimages/large/sandscorcher.png': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAAoCAYAAAB5LPGYAAAABHNCSVQICAgIfAhkiAAAHuJJREFUeF7tfAmUHVd55ldVr+rta++b1Kta1oJlS7ZsYRsjGxIbY5vAgA9wIA4hTJIBJoclMwwnExIyM54hzADJDMmQgJ2BYQuxAzZgZCNkIVuyNlutpaVWt3p7r9/rt++1z3efZR8PkeM2boxwdHVK1a+WW7fu/e6/fP9/S2pra8OlcqkHflk94PllPfilPPeWW24J+4Lhtabt+hLBkAbNo0VDEa1ULnkhy+q56TPJPbt//MRLqfPlXHv33XerjUZDc/0xtV4pqT944NtaIJpQ148M6vv370+9WN3vete7uj0eT/zee+89+WLXvtrPSxejBBwdHdWGL9scVxVZfd3112uP/OhHH0hEEx/XXRu9HZ1QNQ9cSDh46DA6OzpQrVZnRocG/yQUDdZtFwocqK5ju4ZlyqZhKz6f6inky8uQ7FxyceEoB1XftWuXvoLBlXbs2KEcOHBgg2VZPZ1dfb1vfdtdf1vI5mDx5ra2OKZnzmHfnkfQ2dmJsbHhQ+Ov2fqblVJdy+TrWh2aprqGZpmOt82vaJ0dPm9vX48muc6vz8/N9xSLxd2zc7NQFE1rj7f5t127zf3kJz7xkRW061VzyUUHwNdd/rpwXbPuHhka+5xFmG3ZsgEHDhxFDwc4Fg8j0ZaA6wDHT5zFd3ftxq/dsI3nuqAFvYhGQvBpKgzLhuM4CIdDMAwDkuui2WyiUCi4iiLDFb8bOmRFgs/nh9erIRgIwbJNaWhgEI4kYXZhDoqsQFE18AaoXj8k1vsoBW08Hsfg2l5YjoV7v/l9rO2N4dptl8Nh3ZokI1uqo1wxUXE0eD0O6g0LES8QDyvo6WpDd1cnZmdnIbH+5GIKjguYlgW9WcV3vv116VWDrhW8yEUFwM2bNwdkOVzzaj6CyGiByOePoFqrIxQOo7+7H7H2KBbmk9h/7Di6OKo93QlIBEzTMAkmgo97UzfA0UU3gVkh0HTDgsfrw3KpgZ6hdQSYghpFpW0TjPzbVILwaF40KhWEvCokj4x6NgVXFj2owLAdKK6JBGwUMosIRyIt4FZyGUzMnoJEIEYCccRDQcAxYZiNQpO7phayI5GwUygW7IRHsjyy0TnY1xuUOQsSUT/Ozc3BR/Cn0pk/si3TakvE9cOHnvzsCsbtVXPJRQXAnpGNn9Et5SOV5EmEou1IJCJoi3fj3EIW1UYN4VgXfB6Cp15GLBjGmamDBJMHCgEgyzIllnzW7w+UXLiEFxzLdmsUJzVFUeuG4ySJp4Zt217Dtu9wZMWRIDccSXZ8Tl0IoSZVo03x6lDwFiS4DdaT599pAjztuk6qc9NNf1iyw9c1KsstiSgbOgJ2GcUcpZleocQNotGoZyhtu14IIcFw2ynTqI/HYs84fwLky6mFf1FS7/l9c9E4IZ/85Cflr/79999bTp3CunXrKWtcmJRmi6lZShSppe4K+UWoHhV+X4Bq0YG/vZ+SiX82y1BlKdcdb9s5OTM590KD/+xxjvZHlfM/hJAT9twLFUpldcqKJhon96aLtrknqQXTtk+I6BIhW8Zl3WuoYqsISS4MTxiR9vb5LRu3XtHldb2WaWhLi0taOJY4tnvP99LiGddu3fFIrVkbd6n+heQOBQOwLnvN23786EPffqE2/LzHc6//K3lYfkLpMbOeN/YPSnP1ednOW/ITC9PSPX/2p/KPd+9xvvKlL+K3bn+HW3LLNGyAMgJSrNJEWSobpcgQ1nnNX3dlpU1RJFrgHulr933xb3/e9lzovotCAtLpCF21/ZqK3tSh+YPI50vIFCsYWDuCh2ZK6Jaa6An5YehNvoMLf4Dqj7adzC7RqEJ12k+KT5uVPeqDxXKxrsgetyOYMF3JkVRFUs9mit6MCW+wXvbcec2ILx4NqPdHX6sld+/xdvf1aVJ92j/cv94ju02vGYyoffFuLRTyaBGpqbn0Iwwt7GkPBOW6FvZtCsU8n3l4DwblBlTbQHU5iWN2FLlcEVviPrSHPDix93u48aotLbtzOZvHmoH+e72a9+9pmwaJu9e7svs7pUKBNqhC29NPn8k9bjn2P+qNptdo6t5wKKoFggFvqVjSILPdAZ9GdHhpkmjVek3LLWe1nq4eGqcSMtmcNLRmjUxbVXcsi5iWsq7soFQoemSPbAapEWxOVttxq81mwymXSs6J48eNu3/z3Z7pmenqyZMnrfF1G5yerm5LaJGpqTM0YxWPonh0TfV4as3m75XLlQC1Cc0c3SpXKvc0a9Xi7LlTn7kQoF7qsVcMgGtHxoYWFlK7XNfWFLgqbSg16A+qb3jjTtU0DfWps2kl2taPc6UyjtcCGFVyGOyKo6T1006jsqTY8igq9xR5LDTT4FdlWLIXm3v6cKQs4zfWDkILDKLO0ZrJzmO+ksQyVePeR+7HjWO9yJ6dQCCoIin3YkHrwC3r1+BkrYJ3ju/AEUrXZNVF1VGwzPrLUsDh+NpQvB6UcuKBNUS7A+/bcrW8UXE4AWR8YAD44JPLGEaWE+UI8sd/istCdRzd9yDeePPtME0bjWaDzwxCN01WIcyHKrwUv416De3tbcKDp53row3qoT3oQ6lUocR3iTvngtdYlgNSOLRMNQLCen797vn6XdYvsX7pQvXP0flp72jDHXfejgfufwBTZ6YwMjyCcDSM06dOIxwKo1FrUtPwGdzKtSonUY4mtczOoK2t12HTPr/ppjd8/qEH7//wSwXcz17/iqlgVXIXVVkZ7uzqpZHvRa2UwVXbr8L68fX4H995HPnubcicSxJVAVw52o8UNuCMFqBdR0eEw0ENAEvRWgY/JR2iEjtf9kHt2YLbt4xhNA/87ihfz8/NBqZSG3GsuBG/ce/n0N1Mo81SCco5nPFeA11N4KO33YWmaWFAKSEe0ZAsx/BUs4TOiA8+S0fZbsgcBXny1puxexH4wNHH/N/YOvTUbcO4QqLh5he6m9s339iBmVwH7jnyGK4nZk+fnqRqBaVeHxKkiOhJYXZ+AeVyGWsG17Q86iDBViPwI+EIpqanMNA/QFC0w6N6kEySRpRUaPSoL3SNTi0wv7BIZ8vB5sHh59cvna9feqH6VTIEFLro6+3FjTtei2a9gXNnp3HNNdtbbR4bHYNLbVLMF2lT80LO+mq1hlK1AlVlm3y+lmMYjUXR39f/ofTS/FcPHTp04GdB9VJ+v2IAnJqaMtq7et5Fb/OrqvA46z4Ui3X89bcfQWLDjTh15BgQacM7L4/gsWoXwvQO1/gsxCkVXKsJD9WII9lI+NtRMRsIxwcw1nMdOxPoUIH3x2jMN/h3HXhyMoU5bw9+0JxF99yjuGqsD/NVHWr7IPSOy0DRA6cepAyRsau0gONVCet8Edz42nHM0AGqkjYxHAN7awpue2QfNgU6kLz9eqUniCsE6BDmRhOQQkpoQQzx2YP0wKm30KymKYXj6OrpxKYNm+H1abjtTW9CQ9exmJxHpVhEJBRANBpFX2c3FjMpFMolxCJRTEwcQ1dXB52ZGKKh0AWvefrpp9DJ9nd2dWNgYPgl1X/q9Clcvvk19OpNLKRSlHYhApI6nsDv6mZbFhaQZvsk2gk2gRgNRjC+fhya10spmKXjpZHrXNd6507ysU8efOJW9sDFC8C3vu3tfxcMRdYnU2mtWMhrPn84cvjwAVy7/XpUSyVKiXYUskEUF05CKZ3FVl8ST85dQ6I5C4vqcN7jw4SvG4YSo6erY1mL4j+3b8XXl85hp3oZ3tNHLHCizpN1oQZGjvvZM8CfHHwM26+8ncBZi38wijiepOqDirRNz9PwYyi+EZ89e6TVkVfH+vHTTBL3XH8bavkKoG3Bo+Qa7xsEvkGq+u2navj4tUF8hlr4z8myCOkKgrxVhLSlWbqfOns4Ekb2dA5a2yjUZgGPPrILk5MnyU1G0NHZQcqHFA4H1yQtZFkmqqR8orEY1XOgtQnJMj8/T2B1InXwMG3D4AWvOTc7gwDt5PJyE7l0mZzj0orrP3n8BPoHBrB33178ePduBpRU2OyDJ48exXI6TY61jbxkEgFSTELiKTx/amoKKidRs0l7l+bDD3/4MGmtZguIs7PzW8/3xM+9WzUJ+K8/+JGvNkolryRLWkM3vaRLgqFoeEdvV4/08MM/ahG/g0OjnHUxFCpVSsA6FpaLSFlhgsPLAWL4ItaHM06kBRLaXnwpDVvCV2MNZ+g/NoiA4CC+Vlbwaz3bMEapd7DI8afU+y73G3jLXbTJjhOQN6y9CmtiPty1ex+8lot6oYhGmGjVIjba1+Evrr5SSdavxPsf/7F7y9orJWch6B5M69K/3RDGNoIrREtgB038Ljrb39seRIz7jXweRG+Z3AhMalIYVdpylIJfKQCPzmfQQ1uxSUB47RrqzRhOT51pEeEe2k8WSWybLE+IXKFM6kjjAOdp79YbDdqKJgdbQq3sIhKdpw1oEgCMOF7gmkad9hmPk26EGvC0HJ2V1l8olHB88jRSqQW00dYM0PYUnniOKjfP38IkqVQbrU3YfOVKGRVuHg/bQunHaBD5WZOqu4r5VAYhP1XZyyyrAsChtcN/FNKUdz5+7AQEAeel2gxxBoONlCh5VP6WFA+KtCdMk8QwAajrNcQ4GJlFHTWXootqYakiRl/4e0SRh0CkKjiancTRUBz/YWwrbh1h+IvAGPGROuFzfvsw8FUhkYRzzNs0PjLH45/KF/D1kSFKKnqaVgNOIMFriFLJpyB/znnTA7uce2682X1D32b7U/t/QOZZkQ4uTrvfmg0V/mbL9eEumpbnWO9ZgruX9S7U+DdBJ5yT3+4GvkBCJc0m3xoHVTewleBfYy2LEDWaNBdEmDBJFSfUmJBsXh9D1vzXpP2WpSqrc/Jpmr9l89UFv0nDX2MfLRRLSBTofhCsOlX2ha4pFPOtyE+Fzou9/AxZL8DRbDSpTpV/tv5AwIelTLrlfccYzYkwcjQxcZzmgYEgHaXkUprg9jIi02i1R0SBIrEESCe12mNw7DSNAyC6nO0eGOj5Y5x+eQhcFQCmlpJHyPYzYlEmHVFozSqVVJlDmmJxLsmBCREfdXqtKrLNGsrVMkNPRkus10yZ9p3NaIQXCxWOaog6IdyLT11+Mw4sncUP82dwS8TC3sm9+EFmEFv6+0nJ0ASjBHiM4Ai3A5+gdDpFIHSyL7ZRWpVGr8RcmT/UIHxGBT7aOQ0Bi+wxFBKjMk4fxR82k/jy7e9RqtW1eHzuaYKehl3VjL9vz6Puv998g5tZ8Ei9BPR/mVgQBrk7HOvBp84dc99vyPIfb9mI9TxX5DOSBOr0PDA3P4k19RxlucW51CBnWQNVQCss6KF0p4GIWCwuyHL4/X720zKByGAjbdsq398qkkoiYBuWj8Clx0ww1+sltpr/COIae7BYzLZAnUwReKxTgKZcLrZCi6KIfhfOg4eq84Xu9VK9OrZFR2aWtmYEOoGU5ibAK4rC5xok2EVdom2tvaDp2Y7WeTqDXk21y4Xc1w7sy+xrHXwZZVUAyJn93euvu+6vFxdS5LdKtG0SpAd0Og0yZw5BRenX3tONbDJNA9hqvZTG2TVBm8SiXWZGKVbsJsKzT0CXiaDCLP7jmV28j6hix3x3is0kiODuwaFjpI1H7sBrO0dwS1uo5RMU5htUuX7QNEKS+K2WapiCgcNvuxFX7h1CR+kU7ZoIh5BAKBEtNsXZ4iHc/QD3VDugw/H28euk92/qw2wFksnLfpLM4a8Ofp96lu61o3NkOUAy9SQh9iBl4ZOkJkh2YPK974ZepkgkEGVK8o7uIWSpwsws1a8jM2Ghm152GCV6wXXG52qVLB39IHp6+iltPAQl20W1wcyelrQUYPIRoGK8L6MDMLZuDOn0ktO6v96QDh8+LNGeppPTg3AwhA46Ay2JSg+VXKNQGoLza907MjZCsAdaHviZM6fxxBP7UaKg6O3tc2KxqJtaWnIj0ajb19fv0CSSqGJlw7QkOibEOWcB355DpUTC4UA4HJZ9Ph9j6Yp5/PjxR5gN9J9eBu6eu3XVeMD3vOc9iVOnz+aOzlXgLc/D5CA7NLwFuSn4CmHQikG0zCYTBvw0ZGuMp4YwOLwePy3QltEbSGRPIB+irZYgnyJT1BPArU3ATBZzRfwmEOwGtgww0YBS1JWp4pUActwvEjgtz6AZ5Z76U4C2SrV+4j4kzCITA6heqB7z3Tt4nHRHnM+hYyOcEai8T9Qt/nbFf88rlFAtAdBqD/dOlhvFMAEDk46Lwmfkl6DpebTrmZYKNgg0wdcF6UlGGXYj31fu6+1/yO/XjMNHDuiO4xqxSEwfHxvX1w4PGp2dHZwNsp5eWtIX5ueNTDqtD4+OGANrBnROkacp1Qy30YgcOHRUOXnqmO0LRfTx8XFzw+CIRRLZLrqWbWdK5nRmxqQzY951113Wpz/96VaPXMxl1QAoXvKa625yd1XbEaUdJAS6ThI4X8xwkGqIN3MIyXTtE+3lXGYpIma6RnsjGKZaUiUcpyRsK0xzoG3UtAgaAYZTBSAIrGdG/Xw3tgDJ4+QDW45KS/20UPPM9WIvLjmvMujdQK6cQ7yWhK6F4beYqeKNIyjzOk6GfGhtS1W3AN+6R2xiJyQjhUBrArGI5wkgkiNsFUpynncjZkXyiInAJiRoU1WKJG0pC13eHwpHnJGhUaVQLD+0uDi3y9Dr//2Zmy/9/2wPrIoKfrYyLdgGveZDhp5uhyajTzaRl+lMVJYYry1AYWaLLxgZd5S8SzvD9CmS6Q94rl5OZ3aN+Ol9WbUWXRGm4xAlfeJy0En80356RhoKLAjvTKKKcUValRhqkTIl1COLynPPEKi8kNcICeQhmVo2luFQAnsICpW2WLtNEs+iheO6Um9tRriTTExoAc+WCCqeUR1Tl7TOda7TJEnIScB4aMuU8LPOZiVlu5bJZpDECPcLh4inFbdSyxqqN1i19HqZkYQqbaWzhXLVMzN96vZn++jS/v/vgVUF4ILgx1wOlJBuDlVtrANSnuZ/3YsKQ2YxqtGZyYkl0QQhVyoiZ65SeWpkdKxGu8YXCAQUQcKaQjKROhFgFEa7h5knIUpKNRgFc0thG1SvlDgSwQBGRwQQBU4dASNeb3jIY1Eq1WlDMuzH3x1QJckNS7pUS59hSEUXdVNn2XVVtb/hVb3/m3C2dL0R47Ov4/GPiTa6Syf+IBjv+8tSZnpRG7xisz5z2OGT/4/X631ry0tUghlm8VX0zMyYcMZFeXYvLChBkdCAO3/m0u5CPbCqAMxXyFfUqKKYyJS1aAsybcpVSf7SwRCSS3hVFyh/2TBJoAS6SdgIjpehqkQ7vcIqNSylafcVIJKJNp4NMbRFwFFn09SjZBWaV4y0UIdCPYp40rNalN4vJRtRyeMMkRF0RKmw1fJSp1tgXkdTjUQifiapftIsLQuG5dlyU//IplBm/vRcJNHxhXxmrkKR+A6C7+6OnsG/yKXnBCWxn9vr6NHQw7pUXk4PrCoAu6VKvdkoB2Squq0bxnF/igPP2Cpoc1kqvUaQuf2n5Q5D8Ez0BFWCSySLlhgK04Md8FJt++sZOLQfRWYACpOtjGON9Zdae2KMABPqUyTpm7zfTxBKTB7NUzuafgJWGGfCASIBjewCIqzL5YQI0jNtmo7GSMV76WE+m9lBrwTvdoKcANaJtDcQW+u6yc/zWDPcteZzy6lz4gU+wu1L3M4bi//0hS4dWXkPrCoA2/3udFXSNxk03rkoAwHaaXUxTAFhBwoyllLpZ8qdb3mrMp/MkjML4+jRQzCpRhV6q22SCT/jpR3tQdIrQXrVFslPgzahw8wSFwlGEERmMhUyAcW0LNI6dZKxBr3Zpu6gTAfHFEajMAkIZtQo5MjTDA+PYWlqAu3dvYzNZhmVMH6LTRIgE67z33UOb1mbObG3RtrhqqXZUxlKv7d2dA981LQFOQO66Bd4iZ99qUu/V9wDqwpAw3EPMMV9EwNPWFgiLeF2oO4hAoVqpP0nGP7nl/HNOxrTs2mPxrSqwwf347U7rkaFIaGZ+SRy2TKW/GM41SB4barSliSj+q3MElDkDZlSBL3E9CcZccZUSd9iNl9F0qC0S8SxnfHk/YwUQGMUxKVZQJuUfB6jCO1Iz3hxjhNCMekRN2uiD97M7ePDV956VWZ6f3X0NTeEZs8ek2gLttIOCtnUrR0dHY+JyN+Ke/bShSvqgVUFID3PI8I7lUjW1hmz1P0UGoImEU4qVaXIXt68acv1xyaOPiZaF/Yr951Lpn/nmm1b7VS6lHMl//yhiQP1nu5+zRu1u71WLaHbTOBTEsyRIu9GU68t9ZSb2/671LOUbs0MCkwEdUtJ9CUC6GxUC22G+bjeUHxGW99OBPrQ0VxyPVZV0iwGWpdnpDM5rlMz6pBTE7rlmJMkfxnJxd+I5qhOQ0r0jIcXk7N0LXJ/ymP/i1tKxEBTDK1dKqvfA6sKQAaqZ4R3K8jhBuOe/XEPZpnPaVQplVqUCll+nypUXguAw3LvhxbtqQ970DAL+YXPPvaT+a94fFpyemrCViWnoysa9bc1lpJJj3RQd60+LjtzcxvfIYFerqB2hsvT0PMp5Bm8H0hci/zc9Mdq1bIAkxJx67+3OVj5fJFi2WOWJSsz3YoYsAgiT3McWwTSR+l5B7pHt0mLkwcWM7PHMrZtfse07P9LYJ4VF18qv9geWFUAUlAsieiAQulkERRBcm5Gg4Mu0pnpGDi0C5nSvfHZV/rmEyLhCbj//vvF7sOt43SkBYiprLN5eqz8040HUncveeIP0z0m+AQnyKOMu8YYsqoxp00AS/B/58EnarET8bZ6g0S4XsrIDdqBDvPzo93DVmfnkBv0ynKxWkRucSpYq5bsbGrmU1w196317evmHj+zr4XSS+WV6YFVBaBrO7kCM52ZON/6l/BS54pAtiBxSaOIdHLTtsdW+mpru9Z2Hg5sYC549YcwaiIqLyExDGSOteiYIBMeZCdcIJd4QyAU5MHnSiCXz31pKbVI7NMnNs3HA9G2P2DU5QqG/EZzmdTlTI2aCEXa7quUC0fLy/OtGx8v71tp0y5dt0o9sKoA5JpcZ/uOGxHnFwOKxSZ+kpbQwfW8yw2a7wx3Obaf6VqS8DZXVKJr+rqYeHYv8/i4LI7RCz9vpf3GIDDtvzzUbhXta9bE6SzsHls7gLnBoUYiEVdzhbKSJvgMXWeww2XMw/1vpezSAbE9/8EiqflS+eX2wKoCsNaox/c0OuFJa8hJEeYEKOhUyQMaIluk0UrIrBuWUKArKk8/ue9pdGzsISPNJXDkWbgGpOUFM3fQV5rBrKW4XfGoMzwyklhOp7Bz5+u9S0tLTo3578zWeJAP2cXtB9zOreiBly56xXtgVQHIlTTJdJbUhwiRqVS7VMGZHNWbiEqI8BftQ5Ehs9JidK3fiEhPO5SwDB8ZEQKvX8+1PqlRFauGq9WvTKaT35o8dVIATDgNl8jhlXbuRXLdqgLQsF1zvXGccVh+m6XGpEomTRa4bpZB+1YSgMEULYs83dCGjdtmThw/+GJ9wJjvRIvDYRJAy/lYPokFpnHdPBS3H6t3TwZKM/fz40r7ent7zWPHjl0C34t16EV4flUB2O6XtERHEEG/t7XAJcSEScHT5bnIvMg0+eX8wl6fLP0+IyQnX6wvlEh7vB7sfeYy2nvQC+hnTl+xnMLhQ9OFhNf3UH9b/5Nc99vBnEP9zjvvFCadQY965SL2xRpx6fwvvAdWFYC1Wq2U6JZvbzJapnp8jIr5jWDENBqma9SqNS7lNnNnZ+efH/i/4Asqib6I7gkeZmwZxToXwZDWGXCKSJPn8Xm5qMesz+qN+v4zC2ey/KpC84rxLd50NhN1Nbf8b97y+87h9BFr37599FQulYu9B1Y1IXXVXrZ97XdybevestnkOlWbyamMpkQbjNsyoZWL/p1GMfMPHkX7eKNeYgbrM2X9DW/2v35jv5M+ndYK/NDAYGe02tfXZ/8qZAWvWr/9ClZ0UQKwOHQdP+DBaIdHpGHxG37Z40xEaHCJJT9jYVatkCJ9jKuyPsf+vpDdJ3/onR/0VbxVc3Jy0t25c6dDED7/ugvd8ys4dK+OJougw0VVckPXhWzV58Jh+M4Xh6+WQifX2Spc8KMyU1pkFviCbT96AfCJd3E+/7Uv1L/85S+bVMPP2YPfeudDK6Z/LqoOeZU35qIDINPYdzPmy2VzTD5g3l+Yi35sRlFi/F5gPcA1mLI3ea5WX2mc1j2vgt1/9bVbRTrVc9Iv9+fZFiDFZ+Fe5WP8kl/vvR/8d+z8V6YojMW/Mk9awVNCV9/BT4+lt6v+wBZBGcKpSmHZAL+zxgXnXibExO2mZdwTqyT3rKC6f/aSwMP/tXV+z55WVQKM4nvQHq4o+xejojn5fErWo95w5fVqYk3Ce8Xrb9NOHT1gbRofGT729FNc+veLL6vqBb/c5lYPPGAqkf5vObXlXi4U7xppi7SvH+CSxkpJn1kqpwuF9INyrfA/X+5zfub+5wD3Xe97nbG371RuMCbcTZs2uRMTE9Kbut8svf+L7xOq/FUHTH7soDcjlR2vVOFk9yEmVsBzQcWJMzPkvV6Z8v8AJUG8UrU0Ia4AAAAOZVhJZk1NACoAAAAIAAAAAAAAANJTkwAAAABJRU5ErkJggg==',


        // Add more mappings as needed
    };

    // Function to replace background images
    const replaceBackgroundImage = element => {
        const originalBackgroundImage = window.getComputedStyle(element).backgroundImage;
        const originalUrlMatch = originalBackgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (originalUrlMatch && originalUrlMatch[1] in imageMap) {
            const newUrl = `url(${imageMap[originalUrlMatch[1]]})`;
            element.style.backgroundImage = newUrl;
        }

        // check if is img tag
        if (element.tagName === 'IMG') {
            const originalSrc = element.src;
            if (originalSrc in imageMap) {
                element.src = imageMap[originalSrc];
            }
        }
    };

    // Mutation observer to handle dynamically added elements with background images
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.target.nodeType === 1) {
                if (window.getComputedStyle(mutation.target).backgroundImage !== 'none' || mutation.target.tagName === 'IMG') {
                    replaceBackgroundImage(mutation.target);
                }
            }

            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    // Check if the element has background image set via CSS
                    const computedStyle = window.getComputedStyle(node);
                    if (computedStyle.backgroundImage !== 'none') {
                        replaceBackgroundImage(node);
                    }
                    // Check if any child elements have background images
                    node.querySelectorAll('*').forEach(child => {
                        if (window.getComputedStyle(child).backgroundImage !== 'none' || child.tagName === 'IMG') {
                            replaceBackgroundImage(child);
                        }
                    });
                }
            });
        });
    });

    // Observe changes to the DOM
    observer.observe(unsafeWindow.document.body, {
        childList: true,
        subtree: true
    });

    // Initial replacement on existing elements with background images
    unsafeWindow.document.querySelectorAll('*').forEach(element => {
        if (window.getComputedStyle(element).backgroundImage !== 'none' || element.tagName === 'IMG') {
            replaceBackgroundImage(element);
        }
    });

})();