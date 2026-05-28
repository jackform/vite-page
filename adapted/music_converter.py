import webtkinter as tk
from webtkinter import messagebox


def number_to_letter(number_str):
    """
    将简谱数字字符串转换为字母谱字符串

    参数:
        number_str: 简谱数字字符串，如 "1234567"

    返回:
        字母谱字符串，如 "CDEFGAB"

    知识点:
        - 字符串遍历: for char in string
        - 字符串拼接: result = result + new_char
        - 字典查找: mapping[key]
    """
    number_map = {
        '1': 'C',
        '2': 'D',
        '3': 'E',
        '4': 'F',
        '5': 'G',
        '6': 'A',
        '7': 'B',
    }

    result = ""
    for char in number_str:
        if char in number_map:
            result = result + number_map[char]
        else:
            result = result + char

    return result


def letter_to_number(letter_str):
    """
    将字母谱字符串转换为简谱数字字符串

    参数:
        letter_str: 字母谱字符串，如 "CDEFGAB"

    返回:
        简谱数字字符串，如 "1234567"

    知识点:
        - 字符串遍历
        - 字符串拼接
        - 字典查找（反向）
    """
    letter_map = {
        'C': '1', 'D': '2', 'E': '3', 'F': '4',
        'G': '5', 'A': '6', 'B': '7',
        'c': '1', 'd': '2', 'e': '3', 'f': '4',
        'g': '5', 'a': '6', 'b': '7',
    }

    result = ""
    for char in letter_str:
        if char in letter_map:
            result = result + letter_map[char]
        else:
            result = result + char

    return result


def get_note_name(number):
    """
    根据简谱数字获取中文唱名

    参数:
        number: 单个数字字符，如 '1'

    返回:
        中文唱名，如 'Do(哆)'

    知识点:
        - 字典查找
        - 字符串格式化
    """
    note_names = {
        '1': 'Do(哆)',
        '2': 'Re(来)',
        '3': 'Mi(咪)',
        '4': 'Fa(发)',
        '5': 'Sol(嗦)',
        '6': 'La(拉)',
        '7': 'Si(西)',
    }
    return note_names.get(number, "未知音符")


def format_melody_display(input_str, output_str):
    """
    格式化显示旋律转换结果

    参数:
        input_str: 输入字符串
        output_str: 输出字符串

    返回:
        格式化后的显示字符串

    知识点:
        - 字符串拼接
        - 换行符 \\n 的使用
    """
    display = "输入: " + input_str + "\n"
    display = display + "输出: " + output_str + "\n"
    display = display + "-------------------\n"
    display = display + "对应关系:\n"

    min_len = min(len(input_str), len(output_str))
    for i in range(min_len):
        in_char = input_str[i]
        out_char = output_str[i]
        display = display + in_char + " -> " + out_char + "\n"

    return display


def _on_convert_to_letter():
    """转换为字母谱按钮的回调函数"""
    input_str = input_entry.get()
    if len(input_str) == 0:
        messagebox.showwarning("提示", "请输入简谱数字！")
        return
    result = number_to_letter(input_str)
    display = format_melody_display(input_str, result)
    result_text.delete(1.0, tk.END)
    result_text.insert(tk.END, display)


def _on_convert_to_number():
    """转换为简谱按钮的回调函数"""
    input_str = input_entry.get()
    if len(input_str) == 0:
        messagebox.showwarning("提示", "请输入字母谱！")
        return
    result = letter_to_number(input_str)
    display = format_melody_display(input_str, result)
    result_text.delete(1.0, tk.END)
    result_text.insert(tk.END, display)


def _on_show_note_names():
    """显示唱名对应关系按钮的回调函数"""
    input_str = input_entry.get()
    if len(input_str) == 0:
        messagebox.showwarning("提示", "请输入内容！")
        return
    display = "音符唱名对照表:\n"
    display = display + "===================\n"
    for char in input_str:
        if char in "1234567":
            note_name = get_note_name(char)
            display = display + char + " = " + note_name + "\n"
    result_text.delete(1.0, tk.END)
    result_text.insert(tk.END, display)


def make_button(parent, text, bg_color, command):
    """创建一个带背景色的按钮"""
    btn = tk.Label(
        parent, text=text,
        font=("微软雅黑", 12),
        bg=bg_color, fg="white",
        width=12, relief="raised",
        padx=10, pady=6,
    )
    btn.bind("<Button-1>", lambda event: command())
    btn.bind("<Enter>", lambda event, b=btn, c=bg_color: b.configure(bg=c))
    btn.bind("<Leave>", lambda event, b=btn, c=bg_color: b.configure(bg=c))
    return btn


# ============================================================
# UI
# ============================================================

window = tk.Tk()
window.title("简谱字母谱转换器")
window.geometry("500x600")
window.configure(bg="#FFF8DC")

title_label = tk.Label(
    window,
    text="🎵 简谱与字母谱转换器 🎵",
    font=("微软雅黑", 20, "bold"),
    bg="#FFF8DC", fg="#8B4513",
)
title_label.pack(pady=20)

info_text = (
    "简谱: 1=Do, 2=Re, 3=Mi, 4=Fa, 5=Sol, 6=La, 7=Si\n"
    "字母谱: C=Do, D=Re, E=Mi, F=Fa, G=Sol, A=La, B=Si"
)
info_label = tk.Label(
    window, text=info_text,
    font=("微软雅黑", 10),
    bg="#FFF8DC", fg="#666666",
    justify="left",
)
info_label.pack(pady=10)

input_label = tk.Label(
    window, text="请输入简谱数字 (如: 1234567):",
    font=("微软雅黑", 12), bg="#FFF8DC",
)
input_label.pack(pady=5)

input_entry = tk.Entry(
    window, font=("微软雅黑", 16),
    width=30, justify="center",
)
input_entry.pack(pady=10)
input_entry.insert(0, "123 4567")

result_text = tk.Text(
    window, font=("微软雅黑", 12),
    width=50, height=10,
    bg="#FFFFFF", fg="#333333",
)
result_text.pack(pady=10)

button_frame = tk.Frame(window, bg="#FFF8DC")
button_frame.pack(pady=10)

convert_letter_btn = make_button(
    button_frame, "转为字母谱", "#4CAF50", _on_convert_to_letter,
)
convert_letter_btn.grid(row=0, column=0, padx=10)

convert_number_btn = make_button(
    button_frame, "转为简谱", "#2196F3", _on_convert_to_number,
)
convert_number_btn.grid(row=0, column=1, padx=10)

show_names_btn = make_button(
    button_frame, "显示唱名", "#FF9800", _on_show_note_names,
)
show_names_btn.grid(row=0, column=2, padx=10)

window.mainloop()
