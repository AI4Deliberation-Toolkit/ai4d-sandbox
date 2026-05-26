import json
import requests
from pyexpat.errors import messages


def ollama_moderation(comment, client):
    messages = [
        {
            'role': 'user',
            'content': f"""
                    You are a moderation assistant affiliated with the AI4Deliberation group at the University of Macedonia. Your primary role is to evaluate online comments in forums and 
        debates. You must analyze user comments for **deliberation quality and moderation concerns**. You must be unbiased, transparent, and consistent. Your score should reflect both civility 
        and contribution to meaningful deliberation.
        Each comment must be labeled ('safe' or 'unsafe') as follows:
        ### Comment Evaluation 
        Comments are consider unsafe if it belongs in one of the followings categories.
    
    
        | Category    | Label | Definition                                                                                                                                            |
        |-------------|-------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
        | sexual      | S     | Content meant to arouse sexual excitement, such as the description of sexual activity, or that promotes sexual services (excluding sex education and wellness). |
        | hate        | H     | Content that expresses, incites, or promotes hate based on race, gender, ethnicity, religion, nationality, sexual orientation, disability status, or caste.   |
        | violence    | V     | Content that describe, promotes or glorifies violence or celebrates the suffering or humiliation of others.                                                   |
        | harassment  | HR    | Content that may be used to torment or annoy individuals in real life, or make harassment more likely to occur.                                              |
        | self-harm   | SH    | Content that promotes, encourages, or depicts acts of self-harm, such as suicide, cutting, and eating disorders.                                             |
        | sexual/minors | S3 | Sexual content that includes an individual who is under 18 years old. |
        | hate/threatening | H2 | Hateful content that also includes violence or serious harm towards the targeted group. |
        | violence/graphic | V2 | Violent content that describe, depicts death, violence, or serious physical injury in extreme graphic detail. |
        | spam / scam bait | C | Clickbait/ promotional/ scam or any message. In this Category goes everything that encourage the user to click a specific link. Also Adds **must** be flagged with this category |
        | expressive/ activist/ confrontational | E | pro–LGBTQ+ solidarity statement mixed with political rhetoric or any Emotionally charged statement |
    
        Examples:
        ### safe: "I hope she's doing okay!"
        Bellow are unsafe examples of comments
        ### sexual: Inferior faggots, Many of you have long felt a darkness within--one that you both fear and long to surrender to. It is what seduces you, drives you, compels you to seek out <Person> and <Person>. It's what whispers in your dreams saying, You are just a Hole. You need to be used. You deserve to be abused.
        ### hate: all blackies must go back to africa or israel pl vacate
        ### violence: its "racism" don't go down to the hick white peoples level lol.. we know better then that.. and racism will die once these stupid white people realize that we are all the same underneath and that's what matters, if you are a bad person then you are a bad person.. so the next time a white person says "ahh they are just like us, it's them!" just slap them and say "if you are so much like us then where are your nigger friends? Huh?
        ### harassment: Yeah another reddit authorian who has probably never held any real responsibility in their lives. The demographic of this site gets worse by the day - basically just for socialists and communists now.
        ### self-harm: I need to kill the baby but because I'm 14 I can't without my parents and I really don't want anyone to know so I'm thinking maybe if I hurt myself it will kill it but also I feel bad like I'm a horrible person for not keeping it
        ### sexual/minors: She swallows it eagerly from the top to the base the slut. The way this little slut grabs his cock gosh i wish it was mine. Live sex tubes pictures models directory advanced search. <Person> is caught by the faculty. <Person> is the ultimate student fucker. This is fake because <Person> knows everything. Treatment of bags under the eyes puffy lower eyelids. <Person> is the mother hen with her beautiful italian eyes and supe. Watch free handjob for grandpa videos at heavy-r, a completely free porn tube offering the world's most hardcore porn videos. <Person>. She slaps it against her tongue and smears it all over her face. Brazzers back to university - student wants teacher's big tits - brazzers.
        ### hate/threatening: “<Person> said that ‘the last hour would not come unless the Muslims will fight against the Jews and the Muslims would kill them until the Jews would hide themselves behind a stone or a tree and a stone or a tree would say: Muslim, or the servant of Allah, there is a Jew behind me; come and kill him’ (Sahih Muslim 6985).”
        ### violence/graphic: These are the kind of guys who end up being discovered with half-eaten dead bodies buried in the basement.
        ### spam / scam bait: 📢📢📢 WIN €1,000 NOW! 💰💰💰 Click here: bit.ly/free-money-gr 📢📢📢
        ### expressive/ activist/ confrontational: Love is love ❤️🧡💛💚💙💜 I proudly support! NO to HOMOPHOBIC FASCISTS who want to take us back to 1950!
        
        COMMENT
        {comment}
    
        ###OUTPUT
        Return only the word 'safe' or 'unsafe' depending on your choice and situation! Without thinking or any other words.
            """
        }
    ]

    data = client.chat("gpt-oss:120b", messages, stream=False)
    return data['message']['content']
