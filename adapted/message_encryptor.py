# ============================================
# 消息加密器 - 字符替换演示
# 功能：学习字符串的字符替换和加密解密概念
# ============================================

import webtkinter as tk
from webtkinter import messagebox

# 创建主窗口
window = tk.Tk()
window.title("🔐 消息加密器 🔐")
window.geometry("500x700")
window.configure(bg="#FFF8DC")  # 淡黄色背景

# ============ 加密规则 ============
# 简单的替换加密表（字母替换）
encrypt_rules = {
    "a": "🍎", "b": "🏀", "c": "🐱", "d": "🐶", "e": "🐘",
    "f": "🦊", "g": "🍇", "h": "🏠", "i": "🍦", "j": "🎷",
    "k": "🔑", "l": "🦁", "m": "🌙", "n": "🎵", "o": "🍊",
    "p": "🍕", "q": "👑", "r": "🌈", "s": "⭐", "t": "🐯",
    "u": "☂️", "v": "🎻", "w": "🌊", "x": "❌", "y": "💛",
    "z": "⚡",
    " ": "·"  # 空格变成点
}

# 创建解密表（反过来）
decrypt_rules = {}
for key, value in encrypt_rules.items():
    decrypt_rules[value] = key

# ============ 加密解密函数 ============

def encrypt_message(message):
    """加密消息"""
    result = ""
    message = message.lower()  # 转小写

    for char in message:
        if char in encrypt_rules:
            result += encrypt_rules[char]
        else:
            result += char  # 不在规则里的保持原样

    return result

def decrypt_message(message):
    """解密消息"""
    result = ""
    i = 0

    while i < len(message):
        # 检查是否是emoji（emoji通常占2个字符位置）
        if i + 1 < len(message):
            two_chars = message[i:i+2]
            if two_chars in decrypt_rules:
                result += decrypt_rules[two_chars]
                i += 2
                continue

        # 单字符检查
        one_char = message[i]
        if one_char in decrypt_rules:
            result += decrypt_rules[one_char]
        else:
            result += one_char
        i += 1

    return result

def simple_encrypt(message):
    """简单加密：每个字母变成下一个字母"""
    result = ""
    for char in message:
        if char.isalpha():
            # 如果是小写字母
            if char.islower():
                if char == 'z':
                    result += 'a'
                else:
                    result += chr(ord(char) + 1)
            # 如果是大写字母
            else:
                if char == 'Z':
                    result += 'A'
                else:
                    result += chr(ord(char) + 1)
        else:
            result += char
    return result

def simple_decrypt(message):
    """简单解密：每个字母变成上一个字母"""
    result = ""
    for char in message:
        if char.isalpha():
            if char.islower():
                if char == 'a':
                    result += 'z'
                else:
                    result += chr(ord(char) - 1)
            else:
                if char == 'A':
                    result += 'Z'
                else:
                    result += chr(ord(char) - 1)
        else:
            result += char
    return result

# ============ 界面功能函数 ============

def do_emoji_encrypt():
    """执行emoji加密"""
    message = input_text.get("1.0", tk.END).strip()
    if not message:
        messagebox.showwarning("提示", "请先输入要加密的消息！")
        return

    encrypted = encrypt_message(message)
    result_text.delete("1.0", tk.END)
    result_text.insert("1.0", encrypted)
    method_label.config(text="🔐 Emoji加密")

def do_emoji_decrypt():
    """执行emoji解密"""
    message = input_text.get("1.0", tk.END).strip()
    if not message:
        messagebox.showwarning("提示", "请先输入要解密的消息！")
        return

    decrypted = decrypt_message(message)
    result_text.delete("1.0", tk.END)
    result_text.insert("1.0", decrypted)
    method_label.config(text="🔓 Emoji解密")

def do_simple_encrypt():
    """执行简单加密"""
    message = input_text.get("1.0", tk.END).strip()
    if not message:
        messagebox.showwarning("提示", "请先输入要加密的消息！")
        return

    encrypted = simple_encrypt(message)
    result_text.delete("1.0", tk.END)
    result_text.insert("1.0", encrypted)
    method_label.config(text="🔐 字母位移加密（每个字母+1）")

def do_simple_decrypt():
    """执行简单解密"""
    message = input_text.get("1.0", tk.END).strip()
    if not message:
        messagebox.showwarning("提示", "请先输入要解密的消息！")
        return

    decrypted = simple_decrypt(message)
    result_text.delete("1.0", tk.END)
    result_text.insert("1.0", decrypted)
    method_label.config(text="🔓 字母位移解密（每个字母-1）")

def show_rules():
    """显示加密规则"""
    rules_window = tk.Toplevel(window)
    rules_window.title("📜 加密规则表")
    rules_window.geometry("400x500")
    rules_window.configure(bg="#FFF8DC")

    title = tk.Label(
        rules_window,
        text="📜 Emoji加密规则",
        font=("微软雅黑", 16, "bold"),
        bg="#FFF8DC",
        fg="#8B4513"
    )
    title.pack(pady=10)

    rules_text = tk.Text(
        rules_window,
        font=("微软雅黑", 12),
        width=40,
        height=20
    )
    rules_text.pack(pady=10, padx=20)

    for letter, emoji in encrypt_rules.items():
        if letter != " ":
            rules_text.insert(tk.END, f"{letter} → {emoji}\n")

    rules_text.config(state="disabled")

def clear_all():
    """清空所有"""
    input_text.delete("1.0", tk.END)
    result_text.delete("1.0", tk.END)
    method_label.config(text="等待操作...")

# ============ 界面布局 ============

# 标题
title = tk.Label(
    window,
    text="🔐 秘密消息加密器 🔐",
    font=("微软雅黑", 22, "bold"),
    bg="#FFF8DC",
    fg="#8B4513"
)
title.pack(pady=10)

# 说明
intro = tk.Label(
    window,
    text="把你的秘密消息变成只有朋友能看懂的密码！",
    font=("微软雅黑", 12),
    bg="#FFF8DC",
    fg="#666666"
)
intro.pack(pady=5)

# 输入区域
input_frame = tk.LabelFrame(
    window,
    text="📝 输入消息",
    font=("微软雅黑", 12, "bold"),
    bg="#FFF8DC",
    fg="#333333"
)
input_frame.pack(pady=10, padx=20, fill="x")

input_text = tk.Text(
    input_frame,
    font=("微软雅黑", 14),
    width=35,
    height=3
)
input_text.pack(pady=10, padx=10)

# 加密方式选择
method_frame = tk.LabelFrame(
    window,
    text="🎭 选择加密方式",
    font=("微软雅黑", 12, "bold"),
    bg="#FFF8DC",
    fg="#333333"
)
method_frame.pack(pady=10, padx=20, fill="x")

# 第一排：Emoji加密
emoji_frame = tk.Frame(method_frame, bg="#FFF8DC")
emoji_frame.pack(pady=5)

btn_emoji_enc = tk.Button(
    emoji_frame,
    text="🔐 Emoji加密",
    font=("微软雅黑", 12),
    command=do_emoji_encrypt,
    bg="#FFB6C1",
    width=14
)
btn_emoji_enc.grid(row=0, column=0, padx=5)

btn_emoji_dec = tk.Button(
    emoji_frame,
    text="🔓 Emoji解密",
    font=("微软雅黑", 12),
    command=do_emoji_decrypt,
    bg="#98FB98",
    width=14
)
btn_emoji_dec.grid(row=0, column=1, padx=5)

# 第二排：字母位移加密
simple_frame = tk.Frame(method_frame, bg="#FFF8DC")
simple_frame.pack(pady=5)

btn_simple_enc = tk.Button(
    simple_frame,
    text="🔐 字母+1加密",
    font=("微软雅黑", 12),
    command=do_simple_encrypt,
    bg="#87CEEB",
    width=14
)
btn_simple_enc.grid(row=0, column=0, padx=5)

btn_simple_dec = tk.Button(
    simple_frame,
    text="🔓 字母-1解密",
    font=("微软雅黑", 12),
    command=do_simple_decrypt,
    bg="#DDA0DD",
    width=14
)
btn_simple_dec.grid(row=0, column=1, padx=5)

# 结果区域
result_frame = tk.LabelFrame(
    window,
    text="✨ 结果",
    font=("微软雅黑", 12, "bold"),
    bg="#FFF8DC",
    fg="#333333"
)
result_frame.pack(pady=10, padx=20, fill="x")

method_label = tk.Label(
    result_frame,
    text="等待操作...",
    font=("微软雅黑", 11),
    bg="#FFF8DC",
    fg="#666666"
)
method_label.pack(pady=5)

result_text = tk.Text(
    result_frame,
    font=("微软雅黑", 14),
    width=35,
    height=3
)
result_text.pack(pady=10, padx=10)

# 其他按钮
other_frame = tk.Frame(window, bg="#FFF8DC")
other_frame.pack(pady=10)

btn_rules = tk.Button(
    other_frame,
    text="📜 查看规则",
    font=("微软雅黑", 11),
    command=show_rules,
    bg="#FFD700",
    width=12
)
btn_rules.grid(row=0, column=0, padx=5)

btn_clear = tk.Button(
    other_frame,
    text="🗑️ 清空",
    font=("微软雅黑", 11),
    command=clear_all,
    bg="#FFA07A",
    width=12
)
btn_clear.grid(row=0, column=1, padx=5)

# 小提示
tip = tk.Label(
    window,
    text="💡 小提示：字母+1加密就是把每个字母变成下一个字母\n比如：a→b, b→c, z→a",
    font=("微软雅黑", 10),
    bg="#FFF8DC",
    fg="#999999",
    justify="center"
)
tip.pack(pady=10)

# 运行窗口
window.mainloop()
